import { config } from '../config.js';

/**
 * Unflatten dot-path answers into a nested object for the API.
 * e.g. { "owner.fullName": "Jane" } -> { owner: { fullName: "Jane" } }
 */
export function unflattenAnswers(answers) {
  const result = {};

  for (const [path, value] of Object.entries(answers)) {
    const parts = path.split('.');
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
  }

  return result;
}

/**
 * Submit form data to the form-processor-api.
 * @returns {{ success: boolean, data?: object, errors?: array, message?: string }}
 */
export async function submitForm(formId, answers) {
  const body = unflattenAnswers(answers);

  const response = await fetch(`${config.apiBaseUrl}/forms/${formId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return response.json();
}
