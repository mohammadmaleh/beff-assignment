import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Deliberately NOT `new URL(name, import.meta.url)`. Vite rewrites that form
 * into asset resolution at transform time, and the template-literal variant
 * resolved to this test's own source — so every toContain matched its own
 * assertion literals and passed. A test that reads itself is worse than no
 * test. Vitest runs from the package root, so cwd is apps/web.
 */
const read = (name: string): Promise<string> =>
  readFile(join(process.cwd(), 'src', 'app', name), 'utf8');

describe('globals.css', () => {
  it('imports Tailwind before the token layer', async () => {
    const css = await read('globals.css');
    const tailwind = css.indexOf("@import 'tailwindcss'");
    const tokens = css.indexOf("@import '@beff/tokens/css'");
    // Both must exist first: a bare indexOf comparison passes wrongly when the
    // left-hand import is absent, because -1 is less than any real index.
    expect(tailwind).toBeGreaterThan(-1);
    expect(tokens).toBeGreaterThan(-1);
    // The token sheet's @theme inline block needs Tailwind already in scope.
    expect(tailwind).toBeLessThan(tokens);
  });

  it('sources typography from tokens rather than a hardcoded stack', async () => {
    const css = await read('globals.css');
    expect(css).toContain('var(--type-family-body)');
    expect(css).not.toContain('system-ui');
  });

  it('keeps layout on logical properties', async () => {
    const css = await read('globals.css');
    // German runs ~30% longer than English and DE is a shipped locale.
    expect(css).toContain('inset-inline-start');
    expect(css).toContain('padding-inline');
    expect(css).not.toMatch(/^\s*left:/m);
  });

  it('gives every focusable element a visible focus ring', async () => {
    const css = await read('globals.css');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('var(--color-border-focus)');
  });

  it('leaves color-scheme to the token sheet, which actually emits it', async () => {
    const app = await read('globals.css');
    expect(app).not.toMatch(/^\s*color-scheme:/m);
    // The removal is only correct because the generated sheet carries it per
    // theme. Asserting the absence alone once let it vanish from the repo
    // entirely, leaving dark mode with light scrollbars and a white flash.
    const generated = await readFile(
      join(process.cwd(), '..', '..', 'packages', 'tokens', 'dist', 'tokens.css'),
      'utf8',
    );
    expect(generated).toContain('color-scheme: dark');
  });
});

describe('fonts.css', () => {
  it('never reaches Google for a typeface', async () => {
    const css = await read('fonts.css');
    // LG München I, 3 O 17493/20 — embedding Google Fonts transmits the
    // visitor's IP and was found to violate GDPR.
    expect(css).not.toContain('fonts.googleapis.com');
    expect(css).not.toContain('fonts.gstatic.com');
  });

  it('uses the Archivo width axis rather than a second family', async () => {
    const css = await read('fonts.css');
    // "Archivo Expanded" is wdth 125 on the variable font, not its own family.
    expect(css).toContain('@fontsource-variable/archivo/wdth.css');
  });

  it('loads Latin-Extended so German umlauts and ß render', async () => {
    const css = await read('fonts.css');
    expect(css).toContain('latin-ext-400.css');
  });

  it('pins every IBM Plex import to a Latin subset', async () => {
    const css = await read('fonts.css');
    const plex = [...css.matchAll(/@fontsource\/ibm-plex-[a-z]+\/([\w-]+)\.css/g)].map(
      (m) => m[1] ?? '',
    );
    expect(plex.length).toBeGreaterThan(0);
    // A bare weight entry point (`400.css`) pulls Cyrillic and Greek @font-face
    // rules in too. Asserting the filename is what actually prevents that —
    // the previous version grepped fonts.css for the word "cyrillic", which
    // would never appear whether the subsets shipped or not.
    for (const entry of plex) {
      expect(entry).toMatch(/^latin(-ext)?-\d{3}$/);
    }
  });
});
