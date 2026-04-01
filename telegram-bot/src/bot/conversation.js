import { flattenSchema } from '../schema/flattener.js';
import { validateAnswer, formatDateForApi } from '../validation/validator.js';
import { renderQuestion, renderSummary, renderConfirmation, renderApiError } from '../messages/renderer.js';
import { buildOptionsKeyboard, buildSummaryKeyboard, buildEditSectionsKeyboard } from '../messages/keyboards.js';
import { submitForm } from '../api/client.js';

/**
 * Check if a conditional field should be shown based on current answers.
 */
function shouldShowField(question, answers) {
  if (!question.conditionalOn) return true;
  const { field, value } = question.conditionalOn;
  return answers[field] === value;
}

/**
 * Find the next question index that should be shown.
 */
function getNextIndex(questions, currentIndex, answers) {
  for (let i = currentIndex + 1; i < questions.length; i++) {
    if (shouldShowField(questions[i], answers)) {
      return i;
    }
  }
  return null; // No more questions
}

/**
 * Count the total visible questions (for progress display).
 */
function countVisibleQuestions(questions, answers) {
  return questions.filter(q => shouldShowField(q, answers)).length;
}

/**
 * Get unique sections from answered questions for the edit flow.
 */
function getAnsweredSections(questions, answers) {
  const sections = [];
  const seen = new Set();

  for (const q of questions) {
    if (!(q.path in answers)) continue;
    const label = q.sectionLabel || 'General';
    if (!seen.has(label)) {
      seen.add(label);
      const startIndex = questions.findIndex(
        qq => (qq.sectionLabel || 'General') === label && shouldShowField(qq, answers)
      );
      sections.push({ label, startIndex });
    }
  }

  return sections;
}

/**
 * Send a question to the user.
 */
async function askQuestion(ctx, question, currentIndex, totalQuestions) {
  const text = renderQuestion(question, currentIndex, totalQuestions);

  if (question.options) {
    const keyboard = buildOptionsKeyboard(question.options);
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  } else {
    await ctx.reply(text, { parse_mode: 'HTML' });
  }
}

/**
 * Main conversation handler for filling a form.
 * Uses grammY's conversations plugin.
 */
export function createFormConversation(schemas) {
  return async function formConversation(conversation, ctx) {
    const formId = ctx.session.selectedFormId;
    const schema = schemas.get(formId);

    if (!schema) {
      await ctx.reply('Sorry, that form could not be found. Send /forms to see available forms.');
      return;
    }

    const questions = flattenSchema(schema.fields);
    const answers = {};
    let currentIndex = 0;

    // Skip to first visible question
    while (currentIndex < questions.length && !shouldShowField(questions[currentIndex], answers)) {
      currentIndex++;
    }

    if (currentIndex >= questions.length) {
      await ctx.reply('This form has no questions. Something may be wrong with the schema.');
      return;
    }

    await ctx.reply(
      `<b>${escapeHtml(schema.name)}</b>\n\nLet's get started. I'll ask you each question one at a time.\n\nSend /cancel at any time to stop.`,
      { parse_mode: 'HTML' }
    );

    // Question loop
    let filling = true;
    while (filling) {
      const question = questions[currentIndex];
      const visibleCount = countVisibleQuestions(questions, answers);
      const visibleIndex = questions.slice(0, currentIndex + 1).filter(q => shouldShowField(q, answers)).length - 1;

      await askQuestion(ctx, question, visibleIndex, visibleCount);

      // Wait for user response
      let answered = false;
      while (!answered) {
        const update = await conversation.wait();

        // Handle /cancel
        if (update.message?.text === '/cancel') {
          await ctx.reply('Application cancelled. Send /forms to start again.');
          return;
        }

        // Handle /skip for optional fields
        if (update.message?.text === '/skip' && !question.required) {
          // Leave this field out of answers (not submitted)
          answered = true;
          break;
        }

        // Handle inline keyboard callback (for option questions)
        if (update.callbackQuery?.data?.startsWith('answer:')) {
          const value = update.callbackQuery.data.replace('answer:', '');
          answers[question.path] = value;
          await update.callbackQuery.answerCallbackQuery();

          const selectedLabel = question.options.find(o => o.value === value)?.label || value;
          await ctx.reply(`✓ ${selectedLabel}`);
          answered = true;
        }
        // Handle text input
        else if (update.message?.text) {
          const text = update.message.text.trim();

          // If this question has options, remind them to use the buttons
          if (question.options) {
            await ctx.reply('Please tap one of the buttons above to answer this question.');
            continue;
          }

          // Validate
          const result = validateAnswer(text, question);
          if (!result.valid) {
            await ctx.reply(result.message);
            continue;
          }

          // Store answer (convert dates to API format)
          if (question.type === 'date') {
            answers[question.path] = formatDateForApi(text);
          } else {
            answers[question.path] = text;
          }
          answered = true;
        }
      }

      // Move to next question
      const nextIndex = getNextIndex(questions, currentIndex, answers);
      if (nextIndex === null) {
        filling = false;
      } else {
        currentIndex = nextIndex;
      }
    }

    // Show summary
    let reviewing = true;
    while (reviewing) {
      const summaryText = renderSummary(schema.name, questions, answers);
      const summaryKeyboard = buildSummaryKeyboard();

      // Split if too long (4096 char limit)
      if (summaryText.length > 4000) {
        const midpoint = summaryText.lastIndexOf('\n\n', 2000);
        await ctx.reply(summaryText.slice(0, midpoint), { parse_mode: 'HTML' });
        await ctx.reply(summaryText.slice(midpoint), { parse_mode: 'HTML', reply_markup: summaryKeyboard });
      } else {
        await ctx.reply(summaryText, { parse_mode: 'HTML', reply_markup: summaryKeyboard });
      }

      const summaryUpdate = await conversation.wait();

      if (summaryUpdate.message?.text === '/cancel') {
        await ctx.reply('Application cancelled. Send /forms to start again.');
        return;
      }

      const action = summaryUpdate.callbackQuery?.data;

      if (action === 'action:submit') {
        await summaryUpdate.callbackQuery.answerCallbackQuery();
        await ctx.reply('Submitting your application...');

        try {
          const response = await conversation.external(() => submitForm(formId, answers));

          if (response.success) {
            const refNumber = response.data?.submissionId || 'REF-PENDING';
            await ctx.reply(
              renderConfirmation(schema.name, refNumber),
              { parse_mode: 'HTML' }
            );
          } else {
            await ctx.reply(
              renderApiError(response.errors),
              { parse_mode: 'HTML' }
            );
            // Stay in review loop so they can try again
            continue;
          }
        } catch (error) {
          await ctx.reply(
            'Sorry, there was a problem connecting to the server. Please try again later.\n\nSend /forms to start again.'
          );
        }

        reviewing = false;
      } else if (action === 'action:edit') {
        await summaryUpdate.callbackQuery.answerCallbackQuery();

        // Show sections to edit
        const sections = getAnsweredSections(questions, answers);
        const editKeyboard = buildEditSectionsKeyboard(sections);
        await ctx.reply('Which section would you like to change?', { reply_markup: editKeyboard });

        const editUpdate = await conversation.wait();
        const editAction = editUpdate.callbackQuery?.data;

        if (editAction === 'action:back_to_summary') {
          await editUpdate.callbackQuery.answerCallbackQuery();
          continue;
        }

        if (editAction?.startsWith('edit:')) {
          await editUpdate.callbackQuery.answerCallbackQuery();
          const startIdx = parseInt(editAction.replace('edit:', ''), 10);
          const sectionLabel = questions[startIdx]?.sectionLabel || 'General';

          // Re-ask all questions in this section
          for (let i = startIdx; i < questions.length; i++) {
            const q = questions[i];
            if (i > startIdx && (q.sectionLabel || 'General') !== sectionLabel) break;
            if (!shouldShowField(q, answers)) continue;

            const visibleCount = countVisibleQuestions(questions, answers);
            await askQuestion(ctx, q, i, visibleCount);

            let reAnswered = false;
            while (!reAnswered) {
              const reUpdate = await conversation.wait();

              if (reUpdate.message?.text === '/skip' && !q.required) {
                delete answers[q.path];
                reAnswered = true;
              } else if (reUpdate.callbackQuery?.data?.startsWith('answer:')) {
                const value = reUpdate.callbackQuery.data.replace('answer:', '');
                answers[q.path] = value;
                await reUpdate.callbackQuery.answerCallbackQuery();
                const label = q.options.find(o => o.value === value)?.label || value;
                await ctx.reply(`✓ ${label}`);
                reAnswered = true;
              } else if (reUpdate.message?.text && !q.options) {
                const result = validateAnswer(reUpdate.message.text.trim(), q);
                if (!result.valid) {
                  await ctx.reply(result.message);
                  continue;
                }
                if (q.type === 'date') {
                  answers[q.path] = formatDateForApi(reUpdate.message.text.trim());
                } else {
                  answers[q.path] = reUpdate.message.text.trim();
                }
                reAnswered = true;
              } else if (reUpdate.message?.text && q.options) {
                await ctx.reply('Please tap one of the buttons above.');
              }
            }
          }
        }
        // Loop back to show updated summary
        continue;
      } else if (action === 'action:cancel') {
        await summaryUpdate.callbackQuery.answerCallbackQuery();
        await ctx.reply('Application cancelled. Send /forms to start again.');
        reviewing = false;
      }
    }
  };
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
