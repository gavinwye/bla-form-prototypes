/**
 * Flatten a nested form schema into a sequential list of questions.
 * Each question has a dot-path key, label, type, validations, and optional choices.
 */

/**
 * Extract options from a regex pattern like ^(opt1|opt2|opt3)$
 * Returns array of options or null if not an enum pattern.
 */
function extractOptions(field) {
  if (field.type === 'boolean') {
    return [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ];
  }

  const regex = field.validations?.regex;
  if (!regex) return null;

  const match = regex.match(/^\^?\(([^)]+)\)\$?$/);
  if (!match) return null;

  const values = match[1].split('|');
  return values.map(v => ({
    value: v,
    label: formatOptionLabel(v),
  }));
}

/** Convert kebab-case value to human-readable label */
function formatOptionLabel(value) {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Flatten schema fields into an ordered question list.
 * @param {Array} fields - Schema fields array
 * @param {string} parentPath - Dot-path prefix for nested fields
 * @param {string} sectionLabel - Label of the parent object (section heading)
 * @returns {Array} Flat list of question objects
 */
export function flattenSchema(fields, parentPath = '', sectionLabel = '') {
  const questions = [];

  for (const field of fields) {
    const path = parentPath ? `${parentPath}.${field.name}` : field.name;

    if (field.type === 'object' && field.fields) {
      // Recurse into nested object, using its label as the section heading
      questions.push(...flattenSchema(field.fields, path, field.label || field.name));
    } else {
      questions.push({
        path,
        name: field.name,
        label: field.label || field.name,
        sectionLabel,
        type: field.type,
        required: field.required || false,
        validations: field.validations || {},
        conditionalOn: field.conditionalOn || null,
        options: extractOptions(field),
      });
    }
  }

  return questions;
}
