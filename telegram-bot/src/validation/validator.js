/**
 * Validate a user's answer against a question's schema rules.
 * Returns { valid: true } or { valid: false, message: string }.
 */
export function validateAnswer(answer, question) {
  const trimmed = (answer || '').trim();

  // Required check
  if (question.required && !trimmed) {
    return { valid: false, message: `${question.label} is required. Please enter a value.` };
  }

  // If not required and empty, that's fine
  if (!trimmed) {
    return { valid: true };
  }

  const { validations } = question;

  // Min length
  if (validations.min && trimmed.length < validations.min) {
    return { valid: false, message: `${question.label} must be at least ${validations.min} characters.` };
  }

  // Max length
  if (validations.max && trimmed.length > validations.max) {
    return { valid: false, message: `${question.label} must be no more than ${validations.max} characters.` };
  }

  // Regex (only for format validation, not enum — enums are handled by keyboards)
  if (validations.regex && !question.options) {
    const regex = new RegExp(validations.regex);
    if (!regex.test(trimmed)) {
      return { valid: false, message: formatRegexError(question) };
    }
  }

  // Email format
  if (question.type === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { valid: false, message: 'Please enter a valid email address.' };
    }
  }

  // Date format (expect DD MM YYYY, convert to YYYY-MM-DD for API)
  if (question.type === 'date') {
    const dateResult = parseDate(trimmed);
    if (!dateResult.valid) {
      return { valid: false, message: 'Please enter a valid date in DD MM YYYY format. For example, 27 03 2007.' };
    }
  }

  return { valid: true };
}

/** Convert user-entered date (DD MM YYYY) to API format (YYYY-MM-DD) */
export function formatDateForApi(input) {
  const dateResult = parseDate(input);
  if (!dateResult.valid) return input;
  return dateResult.formatted;
}

function parseDate(input) {
  const parts = input.trim().split(/[\s/-]+/);
  if (parts.length !== 3) return { valid: false };

  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return { valid: false };
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
    return { valid: false };
  }

  const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { valid: true, formatted };
}

function formatRegexError(question) {
  const { regex } = question.validations;

  // Common patterns with friendly messages
  if (regex === '^\\d{6}-\\d{4}$') {
    return 'Please enter a valid National Registration Number in the format YYMMDD-XXXX. For example, 010180-0001.';
  }
  if (regex === '^\\d{3}-\\d{4}$') {
    return 'Please enter a valid telephone number in the format XXX-XXXX. For example, 246-1234.';
  }
  if (regex === '^\\d{4}$') {
    return 'Please enter a 4-digit year. For example, 2023.';
  }
  if (regex === '^\\d+$') {
    return `${question.label} must be a number.`;
  }

  return `${question.label} is not in the expected format. Please try again.`;
}
