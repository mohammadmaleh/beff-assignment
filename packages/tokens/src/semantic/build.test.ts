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

  it('declares every colour twice, hex before oklch', async () => {
    const css = await read('tokens.css');
    // A browser that cannot parse oklch must keep the hex declaration, so hex
    // has to come first in source order. Plain cascade, no @supports.
    const hex = css.indexOf('--color-graphite-950: #');
    const oklch = css.indexOf('--color-graphite-950: oklch(');
    expect(hex).toBeGreaterThan(-1);
    expect(oklch).toBeGreaterThan(hex);
  });

  // These are solver outputs, not aesthetic choices: a later WCAG gate is
  // tuned against these exact anchors. A reference resolving to *some* hex
  // colour isn't enough — it must resolve to *this* hex colour, or a wrong
  // ramp stop with higher-but-still-passing contrast would pass silently.
  it.each([
    ['light', 'color-surface-base', '#faf8f5'],
    ['light', 'color-text-default', '#1c1a17'],
    ['light', 'color-brand-default', '#476f95'],
    ['light', 'color-status-success-fg', '#317952'],
    ['light', 'color-status-warning-fg', '#876620'],
    ['light', 'color-status-danger-fg', '#a75343'],
    ['dark', 'color-surface-base', '#1c1a17'],
    ['dark', 'color-text-default', '#faf8f5'],
    ['dark', 'color-brand-default', '#618ab2'],
    ['dark', 'color-status-success-fg', '#4e956c'],
    ['dark', 'color-status-warning-fg', '#a4813f'],
    ['dark', 'color-status-danger-fg', '#c66f5d'],
    // The dark focus ring sits one ramp stop lighter than the dark brand, so
    // the two read as distinct signals. Nothing pinned this and it silently
    // collapsed onto the brand colour once already.
    ['dark', 'color-border-focus', '#83a5c7'],
    ['light', 'color-border-focus', '#476f95'],
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

  it('keeps a shared token identical across themes', () => {
    expect(tokens.light['space-4']).toBe(tokens.dark['space-4']);
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
