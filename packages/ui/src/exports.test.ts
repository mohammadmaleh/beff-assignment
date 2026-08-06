import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The barrel rule, enforced.
 *
 * The rule is not "no barrels" - it is "no *root* barrel". A per-unit barrel
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

  it('points every module subpath at a barrel, never at an implementation file', () => {
    // Consumers import from the barrel so internal layout can change without
    // touching call sites. Stylesheets are exempt and checked below - a CSS
    // file has no barrel to hide behind, and `@import` cannot resolve one.
    for (const target of Object.values(manifest.exports)) {
      if (target.endsWith('.css')) continue;
      expect(target).toMatch(/\/index\.ts$/);
    }
  });

  it('exports the stylesheets the app and Storybook both load', () => {
    /*
     * `base.css` and `fonts.css` live here rather than in `apps/web` because a
     * `Button` with no focus ring and no pointer cursor is not the component
     * this package ships - and because Storybook has to render the real thing.
     * Two copies of that base layer is how a design system starts disagreeing
     * with the product it documents.
     */
    for (const name of ['./base.css', './fonts.css']) {
      const target = manifest.exports[name];
      expect(target).toBeDefined();
      expect(readdirSync(join(ROOT, 'src', 'styles'))).toContain(target!.split('/').pop());
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

  /*
   * A story per component, enforced the same way the barrel is.
   *
   * A design system whose explorer covers *most* of it is the failure mode
   * worth guarding against, not a missing Storybook: a reviewer opens it, does
   * not find a component, and concludes the component does not exist. Asserting
   * per directory - rather than counting story files - is what makes this a
   * structural rule instead of a number that stays true while the wrong eleven
   * components are covered.
   */
  it.each(components)('co-locates a story with %s', (name) => {
    const files = readdirSync(join(componentsDir, name));
    expect(files.some((f) => f.endsWith('.stories.tsx'))).toBe(true);
  });
});
