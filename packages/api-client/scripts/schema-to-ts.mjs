/**
 * A JSON Schema → TypeScript printer, scoped to what FastAPI actually emits.
 *
 * ## Why this is hand-written
 *
 * `openapi-typescript` is the obvious dependency and would normally be the
 * right call. It could not be installed in this environment, and the choice was
 * therefore between a hand-written converter and no drift check at all.
 *
 * What makes that acceptable rather than reckless is the last function in this
 * file: **anything this does not understand throws.** A generator that guesses
 * is worse than no generator, because it produces types that compile and lie.
 * A generator that refuses produces a build failure naming the construct it hit,
 * and someone extends it — or reaches for the dependency — deliberately.
 *
 * Handled: `$ref`, objects with `properties`/`required`, arrays, `anyOf`
 * (including the `| null` FastAPI emits for optionals), `enum`, `const`, and the
 * primitives. Not handled, on purpose: `allOf`, `oneOf`, `not`,
 * `patternProperties`, tuple `items`.
 */

/** Types whose names are safe to emit as bare identifiers. */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const quote = (key) => (IDENTIFIER.test(key) ? key : JSON.stringify(key));

const PRIMITIVES = {
  string: 'string',
  integer: 'number',
  number: 'number',
  boolean: 'boolean',
  null: 'null',
};

/** `#/components/schemas/UserResponse` → `UserResponse`. */
function refName(ref) {
  const name = ref.split('/').pop();
  if (!name) throw new Error(`Unparseable $ref: ${ref}`);
  return name;
}

function indent(text, depth) {
  const pad = '  '.repeat(depth);
  return text
    .split('\n')
    .map((line) => (line === '' ? line : pad + line))
    .join('\n');
}

/**
 * Render one schema node as a TypeScript type expression.
 *
 * `depth` is only for pretty-printing nested object literals.
 */
export function toType(schema, depth = 0) {
  if (schema === true) return 'unknown';
  if (schema === false) return 'never';
  if (typeof schema !== 'object' || schema === null) {
    throw new Error(`Unsupported schema node: ${JSON.stringify(schema)}`);
  }

  if ('$ref' in schema) return refName(schema.$ref);

  if ('const' in schema) return JSON.stringify(schema.const);

  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  }

  if (Array.isArray(schema.anyOf)) {
    // FastAPI writes `T | None` as `anyOf: [T, {type: null}]`.
    const parts = schema.anyOf.map((member) => toType(member, depth));
    return [...new Set(parts)].join(' | ');
  }

  // A few OpenAPI producers emit `type: [...]`; handle it rather than throwing
  // on something this trivially expressible.
  if (Array.isArray(schema.type)) {
    return schema.type.map((t) => toType({ ...schema, type: t }, depth)).join(' | ');
  }

  if (schema.type === 'array') {
    if (Array.isArray(schema.items)) {
      throw new Error('Tuple `items` is not supported; add it deliberately if needed.');
    }
    const inner = schema.items === undefined ? 'unknown' : toType(schema.items, depth);
    // Parenthesised so `A | B` under an array does not become `A | B[]`.
    return /[|&]/.test(inner) ? `(${inner})[]` : `${inner}[]`;
  }

  if (schema.type === 'object' || schema.properties !== undefined) {
    return objectType(schema, depth);
  }

  if (typeof schema.type === 'string') {
    const primitive = PRIMITIVES[schema.type];
    if (primitive === undefined) {
      throw new Error(`Unsupported primitive type: ${schema.type}`);
    }
    return primitive;
  }

  for (const unsupported of ['allOf', 'oneOf', 'not', 'patternProperties']) {
    if (unsupported in schema) {
      throw new Error(
        `\`${unsupported}\` is not supported by this generator. ` +
          'Extend scripts/schema-to-ts.mjs deliberately, or switch to openapi-typescript.',
      );
    }
  }

  // No `type`, no `$ref`, no combinator: genuinely unconstrained.
  return 'unknown';
}

function objectType(schema, depth) {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const names = Object.keys(properties);

  if (names.length === 0) {
    if (schema.additionalProperties === false) return 'Record<string, never>';
    const value =
      schema.additionalProperties === undefined || schema.additionalProperties === true
        ? 'unknown'
        : toType(schema.additionalProperties, depth);
    return `Record<string, ${value}>`;
  }

  const lines = names.map((name) => {
    const property = properties[name];
    const optional = required.has(name) ? '' : '?';
    const doc = property.description ? `/** ${property.description.split('\n')[0]} */\n` : '';
    return `${doc}${quote(name)}${optional}: ${toType(property, depth + 1)};`;
  });

  const body = lines.join('\n');
  return `{\n${indent(body, depth + 1)}\n${'  '.repeat(depth)}}`;
}

/** The whole document → a `.d.ts` body. */
export function documentToTypes(document) {
  const schemas = document.components?.schemas ?? {};
  const blocks = [];

  for (const [name, schema] of Object.entries(schemas)) {
    if (!IDENTIFIER.test(name)) {
      throw new Error(`Schema name is not a valid identifier: ${name}`);
    }
    const doc = schema.description
      ? `/**\n${schema.description
          .split('\n')
          .map((line) => ` * ${line}`.trimEnd())
          .join('\n')}\n */\n`
      : '';
    blocks.push(`${doc}export type ${name} = ${toType(schema)};`);
  }

  const paths = Object.keys(document.paths ?? {})
    .map((path) => `  | ${JSON.stringify(path)}`)
    .join('\n');

  blocks.push(`export type ApiPathName =\n${paths};`);

  blocks.push(
    'export interface components {\n' +
      '  schemas: {\n' +
      Object.keys(schemas)
        .map((name) => `    ${name}: ${name};`)
        .join('\n') +
      '\n  };\n}',
  );

  return blocks.join('\n\n') + '\n';
}
