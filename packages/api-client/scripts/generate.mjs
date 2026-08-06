#!/usr/bin/env node
/**
 * Regenerate `openapi.json` and `src/schema.d.ts` from the FastAPI app.
 *
 * With `--check`, regenerates into memory and fails if either committed file
 * differs. That is the ENG-33 gate: **change a Pydantic schema without
 * regenerating and CI fails**, rather than the frontend silently typechecking
 * against a contract the backend no longer serves.
 *
 * The schema comes from `python -m beff.openapi`, which builds the app object
 * without binding a port or touching a database. A drift check that needs a
 * running stack is one that gets disabled the first time it flakes.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { documentToTypes } from './schema-to-ts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, '..');
const API = join(PACKAGE, '..', '..', 'apps', 'api');

const SCHEMA_JSON = join(PACKAGE, 'openapi.json');
const SCHEMA_TYPES = join(PACKAGE, 'src', 'schema.d.ts');

const check = process.argv.includes('--check');

/** Ask the API for its own document. */
function dumpSchema() {
  // `uv run` rather than a bare python: the venv is uv-managed and a system
  // interpreter would not have FastAPI installed.
  return execFileSync('uv', ['run', '--no-sync', 'python', '-m', 'beff.openapi'], {
    cwd: API,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

const BANNER = `/**
 * GENERATED FILE - do not edit.
 *
 * Produced from the API's own OpenAPI document by
 * \`pnpm --filter @beff/api-client generate\`. CI runs \`check:drift\`, so both
 * editing this by hand and forgetting to regenerate fail the build.
 */

`;

const json = dumpSchema();
const types = BANNER + documentToTypes(JSON.parse(json));

if (!check) {
  mkdirSync(dirname(SCHEMA_TYPES), { recursive: true });
  writeFileSync(SCHEMA_JSON, json);
  writeFileSync(SCHEMA_TYPES, types);
  console.log('Regenerated openapi.json and src/schema.d.ts');
  process.exit(0);
}

const read = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

const drifted = [
  ['openapi.json', read(SCHEMA_JSON), json],
  ['src/schema.d.ts', read(SCHEMA_TYPES), types],
].filter(([, committed, fresh]) => committed !== fresh);

if (drifted.length > 0) {
  console.error(
    [
      '',
      'The committed API client is out of date:',
      ...drifted.map(([name]) => `  - ${name}`),
      '',
      'A Pydantic schema changed without the client being regenerated, so the',
      'frontend is typechecking against a contract the backend no longer serves.',
      '',
      'Fix: pnpm --filter @beff/api-client generate',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.log('API client is in sync with the OpenAPI schema.');
