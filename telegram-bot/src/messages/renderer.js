/**
 * Format Telegram messages using HTML parse mode.
 */

/** Format a question message */
export function renderQuestion(question, currentIndex, totalQuestions) {
  const parts = [];

  // Section header (only show if there is one)
  if (question.sectionLabel) {
    parts.push(`<b>${escapeHtml(question.sectionLabel)}</b>`);
    parts.push('');
  }

  // Question label
  parts.push(escapeHtml(question.label));

  // Hint text based on type/validation
  const hint = getHint(question);
  if (hint) {
    parts.push(`<i>${escapeHtml(hint)}</i>`);
  }

  // Required indicator
  if (!question.required) {
    parts.push('<i>(optional — send /skip to leave blank)</i>');
  }

  // Progress
  parts.push('');
  parts.push(`Question ${currentIndex + 1} of ${totalQuestions}`);

  return parts.join('\n');
}

/** Format the check-your-answers summary */
export function renderSummary(formName, questions, answers) {
  const parts = [];
  parts.push(`<b>Check your answers</b>`);
  parts.push(`<i>${escapeHtml(formName)}</i>`);
  parts.push('');

  let currentSection = '';

  for (const q of questions) {
    // Skip questions that weren't answered (conditional fields)
    if (!(q.path in answers)) continue;

    // Section heading
    if (q.sectionLabel && q.sectionLabel !== currentSection) {
      currentSection = q.sectionLabel;
      parts.push('');
      parts.push(`<b>${escapeHtml(currentSection)}</b>`);
    }

    const value = answers[q.path] || '—';
    const displayValue = q.options
      ? q.options.find(o => o.value === value)?.label || value
      : value;

    parts.push(`${escapeHtml(q.label)}: ${escapeHtml(displayValue)}`);
  }

  parts.push('');
  parts.push('If everything looks correct, tap <b>Submit</b>.');
  parts.push('To change an answer, tap <b>Edit</b>.');

  return parts.join('\n');
}

/** Format a confirmation message */
export function renderConfirmation(formName, submissionId) {
  const parts = [];
  parts.push('<b>Application submitted</b>');
  parts.push('');
  parts.push(`Your reference number is:`);
  parts.push(`<code>${escapeHtml(submissionId)}</code>`);
  parts.push('');
  parts.push(`<b>${escapeHtml(formName)}</b>`);
  parts.push('');
  parts.push('We have sent a confirmation to your email address.');
  parts.push('');
  parts.push('Send /forms to start another application.');

  return parts.join('\n');
}

/** Format an error response from the API */
export function renderApiError(errors) {
  const parts = ['<b>There was a problem submitting your application</b>', ''];

  if (Array.isArray(errors)) {
    for (const err of errors) {
      parts.push(`• ${escapeHtml(err.field)}: ${escapeHtml(err.message)}`);
    }
  } else {
    parts.push('An unexpected error occurred. Please try again later.');
  }

  return parts.join('\n');
}

function getHint(question) {
  if (question.type === 'date') return 'Enter as DD MM YYYY. For example, 27 03 2007';
  if (question.type === 'email') return 'Enter your email address';

  const { regex } = question.validations;
  if (regex === '^\\d{6}-\\d{4}$') return 'Format: YYMMDD-XXXX. For example, 010180-0001';
  if (regex === '^\\d{3}-\\d{4}$') return 'Format: XXX-XXXX. For example, 246-1234';
  if (regex === '^\\d{4}$') return 'Enter a 4-digit year. For example, 2023';
  if (regex === '^\\d+$') return 'Enter a number';

  if (question.options) return 'Tap an option below';

  return null;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
