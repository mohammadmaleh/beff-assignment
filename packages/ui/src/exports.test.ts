import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The barrel rule, enforced.
 *
 * The rule is not "no barrels" — it is "no *root* barrel". A per-unit barrel
 * behind a subpath export costs nothing; one root barrel re-exporting forty
 * components means importing a button drags the whole library into the bundle,
 * because a side-effectful module anywhere in that graph defeats tree-shaking.
 *
 * `process.cwd()` rather than `new URL(x, import.meta.url)`: Vite rewrites the
 * latter into asset resolution at transform time, which silently resolves to
 * this test's own source. That has already cost this repo a whole suite of
 * assertions that passed by matching themselves.
 */
const ROOT = process.cwd();

interface Manifest {
  exports: Record<string, string>;
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Manifest;

const componentsDir = join(ROOT, 'src', 'components');
const components = readdirSync(componentsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe('package exports', () => {
  it('has no root barrel', () => {
    expect(Object.keys(manifest.exports)).not.toContain('.');
  });

  it('has no src/index.ts that a future root export could point at', () => {
    expect(readdirSync(join(ROOT, 'src'))).not.toContain('index.ts');
  });

  it('exposes every component through its own subpath', () => {
    const exported = new Set(Object.values(manifest.exports));
    for (const name of components) {
      expect(exported).toContain(`./src/components/${name}/index.ts`);
    }
  });

  it('points every subpath at a barrel, never at an implementation file', () => {
    // Consumers import from the barrel so internal layout can change without
    // touching call sites.
    for (const target of Object.values(manifest.exports)) {
      expect(target).toMatch(/\/index\.ts$/);
    }
  });

  it('gives every component a barrel of its own', () => {
    for (const name of components) {
      expect(readdirSync(join(componentsDir, name))).toContain('index.ts');
    }
  });

  it.each(components)('co-locates a test with %s', (name) => {
    const files = readdirSync(join(componentsDir, name));
    expect(files.some((f) => f.endsWith('.test.tsx') || f.endsWith('.test.ts'))).toBe(true);
  });
});
