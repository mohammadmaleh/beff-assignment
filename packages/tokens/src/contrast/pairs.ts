import type { TokenName } from '../../dist/tokens.js';

export type Pair = {
  /** Human-readable, so a failure names the pair rather than an index. */
  readonly name: string;
  readonly fg: TokenName;
  readonly bg: TokenName;
  /** 4.5 for body text (WCAG 1.4.3); 3 for large text and non-text UI (1.4.11). */
  readonly threshold: 4.5 | 3;
};

/**
 * Pairs are named and stated deliberately. A cross-product of every colour
 * against every other produces meaningless combinations — chart series against
 * a status background, say — and a wall of green nobody reads.
 */
export const pairs: readonly Pair[] = [
  {
    name: 'body text on base surface',
    fg: 'color-text-default',
    bg: 'color-surface-base',
    threshold: 4.5,
  },
  {
    name: 'body text on raised surface',
    fg: 'color-text-default',
    bg: 'color-surface-raised',
    threshold: 4.5,
  },
  {
    name: 'body text on sunken surface',
    fg: 'color-text-default',
    bg: 'color-surface-sunken',
    threshold: 4.5,
  },
  {
    name: 'muted text on base surface',
    fg: 'color-text-muted',
    bg: 'color-surface-base',
    threshold: 4.5,
  },
  {
    name: 'brand on base surface',
    fg: 'color-brand-default',
    bg: 'color-surface-base',
    threshold: 4.5,
  },
  {
    name: 'brand hover on base surface',
    fg: 'color-brand-hover',
    bg: 'color-surface-base',
    threshold: 4.5,
  },
  {
    name: 'text on brand fill',
    fg: 'color-text-on-brand',
    bg: 'color-brand-default',
    threshold: 4.5,
  },
  {
    name: 'in spec on base surface',
    fg: 'color-status-success-fg',
    bg: 'color-surface-base',
    threshold: 4.5,
  },
  {
    name: 'near limit on base surface',
    fg: 'color-status-warning-fg',
    bg: 'color-surface-base',
    threshold: 4.5,
  },
  {
    name: 'out of spec on base surface',
    fg: 'color-status-danger-fg',
    bg: 'color-surface-base',
    threshold: 4.5,
  },
  // Non-text UI. Borders and the focus ring are what people forget, and a
  // focus ring nobody can see fails the keyboard-only gate in M4.
  {
    name: 'default border on base surface',
    fg: 'color-border-default',
    bg: 'color-surface-base',
    threshold: 3,
  },
  {
    name: 'focus ring on base surface',
    fg: 'color-border-focus',
    bg: 'color-surface-base',
    threshold: 3,
  },
  {
    name: 'focus ring on raised surface',
    fg: 'color-border-focus',
    bg: 'color-surface-raised',
    threshold: 3,
  },
];
