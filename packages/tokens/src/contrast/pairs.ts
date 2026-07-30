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
  // Chart lines are SVG paths, not text, so axe cannot see them. This matrix
  // is the only thing between a reader and an invisible series.
  ...([1, 2, 3, 4, 5, 6] as const).map((n): Pair => ({
    name: `chart series ${String(n)} on base surface`,
    fg: `color-chart-series-${String(n)}` as TokenName,
    bg: 'color-surface-base',
    threshold: 3,
  })),
  // The spec band is the design's signature element and carries its meaning by
  // position, not hue. That only works if its parts visibly separate.
  { name: 'band range on track', fg: 'color-band-range', bg: 'color-band-track', threshold: 3 },
  // The tick is not asserted against track and range directly. Three greys
  // mutually clearing 3:1 is geometrically impossible once the track must also
  // sit near its surface — a light track forces a dark range, which then hides
  // a dark tick. The tick instead carries a halo, so it stays legible over
  // whatever it lands on. Same reason a slider handle has a ring.
  {
    name: 'band tick on its halo',
    fg: 'color-band-tick',
    bg: 'color-band-tick-halo',
    threshold: 3,
  },
  // Where the tick actually lands: on the range when the reading is in spec,
  // on bare track when it is not. The halo covers the first, the tick's own
  // contrast covers the second.
  { name: 'band halo on range', fg: 'color-band-tick-halo', bg: 'color-band-range', threshold: 3 },
  { name: 'band tick on track', fg: 'color-band-tick', bg: 'color-band-track', threshold: 3 },
];
