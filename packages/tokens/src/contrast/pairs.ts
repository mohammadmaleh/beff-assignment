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
 * against every other produces meaningless combinations - chart series against
 * a status background, say - and a wall of green nobody reads.
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
  // Asserted against every surface a border can sit on, not just the base.
  // Testing one surface let border-default ship at 2.91:1 on sunken while the
  // suite stayed green.
  ...(['base', 'raised', 'sunken'] as const).map((s): Pair => ({
    name: `default border on ${s} surface`,
    fg: 'color-border-default',
    bg: `color-surface-${s}` as TokenName,
    threshold: 3,
  })),
  // `border-strong` is the hover edge on the icon-only theme control, whose
  // boundary *is* present and therefore owes 3:1 under 1.4.11. Buttons no
  // longer draw one at all - a boundary that does not exist has nothing to
  // meet, which is what makes borderless controls permissible rather than a
  // shortcut around this gate.
  ...(['base', 'raised', 'sunken'] as const).map((s): Pair => ({
    name: `strong border on ${s} surface`,
    fg: 'color-border-strong',
    bg: `color-surface-${s}` as TokenName,
    threshold: 3,
  })),
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
  //
  // The ground is `color-chart-surface`, not `color-surface-base`. Series were
  // solved against one surface, and they only clear 3:1 against that one:
  // series 2, 4 and 6 measure 2.81/2.78/2.79 on light `raised` and 2.40/2.38/
  // 2.39 on light `sunken`; series 1 and 5 measure 2.95 and 3.98 on dark
  // `raised`. Re-solving all six to clear every surface would compress the
  // lightness range further, and that range is already what forces the two
  // documented CVD exceptions in `cvd.test.ts`.
  //
  // So the placement is constrained instead of the palette. M2-pre settled "no
  // cards anywhere", which means a chart has no raised card to sit on - this
  // token makes that structural fact enforceable rather than assumed. A chart
  // component consumes `color-chart-surface`; putting a chart somewhere else
  // now requires changing a token, and the token is asserted here.
  ...([1, 2, 3, 4, 5, 6] as const).map((n): Pair => ({
    name: `chart series ${String(n)} on chart surface`,
    fg: `color-chart-series-${String(n)}` as TokenName,
    bg: 'color-chart-surface',
    threshold: 3,
  })),
  // The spec band is the design's signature element and carries its meaning by
  // position, not hue. That only works if its parts visibly separate.
  //
  // An earlier revision claimed three greys could not mutually clear 3:1 and
  // added a halo to route around it. That was wrong: light already cleared, and
  // dark needed only one new ramp stop (graphite.450). The halo is gone, and
  // the tick is asserted against both surfaces it can land on directly.
  { name: 'band range on track', fg: 'color-band-range', bg: 'color-band-track', threshold: 3 },
  { name: 'band tick on range', fg: 'color-band-tick', bg: 'color-band-range', threshold: 3 },
  { name: 'band tick on track', fg: 'color-band-tick', bg: 'color-band-track', threshold: 3 },
  // The limit marks say where out-of-spec begins - the most semantically
  // load-bearing graphic in the band, and previously the only one untested.
  { name: 'band limit on track', fg: 'color-band-limit', bg: 'color-band-track', threshold: 3 },
];
