import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { config } from '../config.js';

const schemasDir = resolve(import.meta.dirname, config.schemasPath);

/** Load all form schemas from disk */
export function loadAllSchemas() {
  const files = readdirSync(schemasDir).filter(f => f.endsWith('.json'));
  const schemas = new Map();

  for (const file of files) {
    const schema = JSON.parse(readFileSync(join(schemasDir, file), 'utf-8'));
    schemas.set(schema.id, schema);
  }

  return schemas;
}

/** Load a single schema by form ID */
export function loadSchema(formId) {
  const filePath = join(schemasDir, `${formId}.json`);
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}
