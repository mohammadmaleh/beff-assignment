import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { tokens } from '../../dist/tokens.js';

const read = (name: string): Promise<string> =>
  readFile(new URL(`../../dist/${name}`, import.meta.url), 'utf8');

describe('build output', () => {
  it('emits custom properties for primitives and scales', async () => {
    const css = await read('tokens.css');
    expect(css).toContain('--color-graphite-950');
    expect(css).toContain('--space-4');
    expect(css).toContain('--radius-chamfer');
  });

  it('declares every colour once, as hex', async () => {
    const css = await read('tokens.css');
    // Hex is the only notation the stylesheet ships: it parses everywhere, so
    // there is no fallback pair to keep in sync and no notation to feature-test.
    expect(css).toContain('--color-graphite-950: #');
    expect(css).not.toMatch(/oklch|color\(|lab\(|lch\(/);
  });

  // These are solver outputs, not aesthetic choices: a later WCAG gate is
  // tuned against these exact anchors. A reference resolving to *some* hex
  // colour isn't enough — it must resolve to *this* hex colour, or a wrong
  // ramp stop with higher-but-still-passing contrast would pass silently.
  it.each([
    ['light', 'color-surface-base', '#faf8f5'],
    ['light', 'color-text-default', '#1c1a17'],
    ['light', 'color-brand-default', '#476f95'],
    // The status trio is solved twice over: for 4.5:1 against its ground *and*
    // for CIEDE2000 separation under deuteranopia and protanopia. The first
    // palette cleared contrast and left success and danger 6.74 apart under
    // simulation — see `contrast/cvd.test.ts`.
    ['light', 'color-status-success-fg', '#407d64'],
    ['light', 'color-status-warning-fg', '#9d5d03'],
    ['light', 'color-status-danger-fg', '#892218'],
    ['dark', 'color-surface-base', '#1c1a17'],
    ['dark', 'color-text-default', '#faf8f5'],
    ['dark', 'color-brand-default', '#618ab2'],
    ['dark', 'color-status-success-fg', '#89c7ab'],
    ['dark', 'color-status-warning-fg', '#dab33a'],
    ['dark', 'color-status-danger-fg', '#c26b4c'],
    // Charts are asserted against this surface and only this one. It aliases
    // the base surface today; the point of the indirection is that moving a
    // chart onto a different ground is a token change that the gate sees.
    ['light', 'color-chart-surface', '#faf8f5'],
    ['dark', 'color-chart-surface', '#1c1a17'],
    // The dark focus ring sits one ramp stop lighter than the dark brand, so
    // the two read as distinct signals. Nothing pinned this and it silently
    // collapsed onto the brand colour once already.
    ['dark', 'color-border-focus', '#83a5c7'],
    ['light', 'color-border-focus', '#476f95'],
    // With no cards in the design, borders do the structural work cards would,
    // so they are load-bearing UI under WCAG 1.4.11. Themed rather than shared:
    // no single hex can clear 3:1 against base, raised AND sunken in both
    // themes — light-sunken needs luminance <= 0.21, dark-sunken >= 0.23.
    ['light', 'color-border-default', '#686662'],
    ['dark', 'color-border-default', '#a4a19d'],
  ] as const)('pins %s %s to %s', (theme, name, hex) => {
    expect(tokens[theme][name]).toBe(hex);
  });

  it('emits a hex-only JSON carrying both themes', async () => {
    const parsed = JSON.parse(await read('tokens.hex.json')) as {
      light: Record<string, string>;
      dark: Record<string, string>;
    };
    expect(Object.keys(parsed.light).length).toBeGreaterThan(20);
    expect(Object.keys(parsed.dark)).toEqual(Object.keys(parsed.light));
  });
});

describe('themes', () => {
  it('resolves different surfaces for light and dark', () => {
    expect(tokens.light['color-surface-base']).not.toBe(tokens.dark['color-surface-base']);
  });

  it('inverts text against surface between themes', () => {
    expect(tokens.light['color-text-default']).toBe(tokens.dark['color-surface-base']);
  });

  it('declares theme-invariant tokens once and themed ones per block', async () => {
    const css = await read('tokens.css');
    const count = (needle: string): number => css.split(needle).length - 1;
    // space-4 never varies: once in :root, plus its @theme inline alias.
    expect(count('--space-4:')).toBe(2);
    // surface-base varies, so it lands in :root, the media block and the
    // explicit dark block — one declaration each — plus the alias.
    expect(count('--color-surface-base:')).toBe(4);
  });

  it('emits color-scheme so the UA renders scrollbars and form controls to match', async () => {
    const css = await read('tokens.css');
    // Without this a dark theme keeps light scrollbars, light form controls and
    // flashes white before paint. It belongs with the theme that sets it.
    expect(css).toContain('color-scheme: light');
    expect(css).toContain('color-scheme: dark');
  });
});

describe('theming cascade', () => {
  it('lets an explicit light choice win on a dark-preferring device', async () => {
    const css = await read('tokens.css');
    // The naive prefers-color-scheme block cannot be overridden by a user who
    // forces light. This selector is what makes the toggle work both ways.
    expect(css).toContain(':root:not([data-theme="light"])');
  });

  it('places the explicit dark selector after the media query', async () => {
    const css = await read('tokens.css');
    const media = css.indexOf('@media (prefers-color-scheme: dark)');
    const explicit = css.indexOf(':root[data-theme="dark"]');
    expect(media).toBeGreaterThan(-1);
    expect(explicit).toBeGreaterThan(media);
  });
});
