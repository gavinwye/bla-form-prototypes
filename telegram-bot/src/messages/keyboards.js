import { InlineKeyboard } from 'grammy';

/**
 * Build an inline keyboard for a question with options.
 * Options are displayed as buttons; callback_data carries the value.
 */
export function buildOptionsKeyboard(options) {
  const keyboard = new InlineKeyboard();

  // Use 2 columns if more than 4 options, otherwise 1 column
  const columns = options.length > 4 ? 2 : 1;

  for (let i = 0; i < options.length; i++) {
    keyboard.text(options[i].label, `answer:${options[i].value}`);
    if (columns === 1 || (i + 1) % columns === 0) {
      keyboard.row();
    }
  }

  return keyboard;
}

/** Build the form selection keyboard */
export function buildFormListKeyboard(schemas) {
  const keyboard = new InlineKeyboard();

  for (const [id, schema] of schemas) {
    keyboard.text(schema.name, `form:${id}`).row();
  }

  return keyboard;
}

/** Build the summary action keyboard */
export function buildSummaryKeyboard() {
  return new InlineKeyboard()
    .text('Submit', 'action:submit')
    .text('Edit', 'action:edit')
    .text('Cancel', 'action:cancel');
}

/** Build a keyboard for selecting which section to edit */
export function buildEditSectionsKeyboard(sections) {
  const keyboard = new InlineKeyboard();

  for (const section of sections) {
    keyboard.text(section.label, `edit:${section.startIndex}`).row();
  }

  keyboard.text('Back to summary', 'action:back_to_summary').row();

  return keyboard;
}
