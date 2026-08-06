import { describe, expect, it } from 'vitest';

import { bandOption, HERO_BAND, STANDARD_BAND } from './band';

import type { ChartTokens } from './tokens';

/**
 * The tolerance band's geometry, asserted on the option rather than on a mounted
 * chart.
 *
 * This is the same split the tooltip builders use and for the same reason: an
 * ECharts option is only *interpreted* inside a render loop, so anything checked
 * by mounting is checked at 0×0 in jsdom and proves very little. The option is a
 * pure value, and every rule this component has - the reading is clamped, the
 * out-of-spec state changes shape and not only colour, the reference marks are
 * never drawn in a series colour - is a property of that value.
 */

/** Distinct sentinels, so a mark drawn with the wrong token is visible here. */
const TOKENS = {
  'color-chart-surface': 'surface',
  'color-chart-series-1': 'series-1',
  'color-chart-series-2': 'series-2',
  'color-chart-series-3': 'series-3',
  'color-chart-series-4': 'series-4',
  'color-chart-series-5': 'series-5',
  'color-chart-series-6': 'series-6',
  'color-text-default': 'text-default',
  'color-text-muted': 'text-muted',
  'color-border-default': 'border',
  'color-surface-base': 'base',
  'color-surface-raised': 'raised',
  'color-surface-sunken': 'sunken',
  'color-band-track': 'track',
  'color-band-range': 'range',
  'color-band-limit': 'limit',
  'color-band-tick': 'tick',
  'color-status-success-fg': 'success',
  'color-status-warning-fg': 'warning',
  'color-status-danger-fg': 'danger',
} satisfies ChartTokens;

/** Porosity after calendering runs 30–35% - see CONTEXT.md. */
const POROSITY = {
  lowerLimit: 30,
  upperLimit: 35,
  domain: [27.5, 37.5] as const,
  geometry: STANDARD_BAND,
  tokens: TOKENS,
  reducedMotion: false,
};

/** Every `markLine` pair, as `[from, to]` with the styling that rides on `from`. */
function marks(option: ReturnType<typeof bandOption>) {
  const series = (option.series as { markLine?: { data?: unknown[] } }[])[0];
  return (series?.markLine?.data ?? []) as [
    { coord: [number, number]; lineStyle?: { color?: string; width?: number; type?: string } },
    { coord: [number, number] },
  ][];
}

function points(option: ReturnType<typeof bandOption>) {
  const series = (option.series as { markPoint?: { data?: unknown[] } }[])[0];
  return (series?.markPoint?.data ?? []) as {
    coord: [number, number];
    symbol?: string;
    itemStyle?: { color?: string };
  }[];
}

/** The x of every mark, in the order it is painted. */
function xs(option: ReturnType<typeof bandOption>): number[] {
  return marks(option).map(([from]) => from.coord[0]);
}

describe('bandOption', () => {
  it('plots against the domain it was given, not against the data', () => {
    // The axis has to be the *plotted* domain. Left to ECharts it would scale to
    // the marks, and a band whose axis moved with the reading would draw every
    // measurement in the middle - which is the one thing a tolerance band must
    // never do.
    const option = bandOption({ ...POROSITY, value: 32.4, inSpec: true });

    expect(option.xAxis).toMatchObject({ type: 'value', min: 27.5, max: 37.5, show: false });
  });

  it('draws the track across the whole domain and the window inside it', () => {
    const option = bandOption({ ...POROSITY, value: 32.4, inSpec: true });
    const [track, range] = marks(option);

    expect(track?.[0].coord[0]).toBe(27.5);
    expect(track?.[1].coord[0]).toBe(37.5);
    expect(track?.[0].lineStyle?.color).toBe('track');

    expect(range?.[0].coord[0]).toBe(30);
    expect(range?.[1].coord[0]).toBe(35);
    expect(range?.[0].lineStyle?.color).toBe('range');
  });

  it('paints the window after the track, or the track covers it', () => {
    // Both are horizontal lines at the same y with the same thickness, so the
    // only thing separating them is paint order. Reversed, the band is a plain
    // grey rule and the specification window is invisible - with no error, and
    // nothing in a screenshot to say which of the two greys is on top.
    const option = bandOption({ ...POROSITY, value: 32.4, inSpec: true });
    const colours = marks(option).map(([from]) => from.lineStyle?.color);

    expect(colours.indexOf('track')).toBeLessThan(colours.indexOf('range'));
  });

  it('draws every part of the instrument solid, never dashed', () => {
    /*
     * ECharts draws `markLine` **dashed** unless told otherwise - it assumes a
     * mark is a threshold. Nothing in this band is: the track, the window, the
     * limits and the reading are all things that *are*, and this app spends
     * `dashed` on exactly the opposite meaning (see `referenceLine`).
     *
     * Found by breaking the reduced-motion E2E deliberately and reading the SVG
     * it dumped: every mark carried `stroke-dasharray="40,20"`. Nothing else
     * could have caught it. Every test here asserted positions and colours, and
     * all of them were right - the band was simply rendering as a dashed sketch
     * of itself, which reads as "provisional", not as "broken", so no reader
     * would have reported it either.
     */
    const option = bandOption({ ...POROSITY, value: 32.4, inSpec: true, target: 32.5 });

    for (const [from] of marks(option)) {
      expect(from.lineStyle?.type).toBe('solid');
    }
  });

  it('marks both limits, and never in a series colour', () => {
    // A limit is a rule the measurement is judged against, not a measurement.
    // Drawn in a series hue it reads as data - the same rule `referenceLine`
    // encodes for the cartesian charts.
    const option = bandOption({ ...POROSITY, value: 32.4, inSpec: true });
    const limits = marks(option).filter(([from]) => from.lineStyle?.color === 'limit');

    expect(limits.map(([from]) => from.coord[0])).toEqual([30, 35]);
    for (const [from] of limits) {
      expect(from.lineStyle?.color).not.toMatch(/^series-/);
    }
  });

  it('omits the target mark when there is no target', () => {
    const withTarget = bandOption({ ...POROSITY, value: 32.4, inSpec: true, target: 32.5 });
    const without = bandOption({ ...POROSITY, value: 32.4, inSpec: true });

    expect(xs(withTarget)).toContain(32.5);
    expect(xs(without)).not.toContain(32.5);
    expect(marks(withTarget)).toHaveLength(marks(without).length + 1);
  });

  it('draws the reading as a line in spec and a diamond out of it', () => {
    /*
     * The rule that survives greyscale, a printout and every form of colour
     * blindness: out-of-spec is a *shape* change, not only a colour change. A
     * version that changed the colour alone would look correct to every
     * screenshot and to axe, and would carry no information at all for the
     * readers it matters most to.
     */
    const inSpec = bandOption({ ...POROSITY, value: 32.4, inSpec: true });
    expect(points(inSpec)).toHaveLength(0);
    expect(marks(inSpec).at(-1)?.[0].lineStyle?.color).toBe('tick');

    const out = bandOption({ ...POROSITY, value: 37.2, inSpec: false });
    expect(points(out)).toHaveLength(1);
    expect(points(out)[0]?.symbol).toBe('diamond');
    expect(points(out)[0]?.itemStyle?.color).toBe('danger');
  });

  it('clamps a wild reading to the plotted domain', () => {
    // The drawing is clamped so a reading of 900 pins to the edge instead of
    // being drawn off-canvas; the component's text readout still carries the
    // true number, which is the one a reviewer would check.
    const high = bandOption({ ...POROSITY, value: 900, inSpec: false });
    expect(points(high)[0]?.coord[0]).toBe(37.5);

    const low = bandOption({ ...POROSITY, value: -900, inSpec: false });
    expect(points(low)[0]?.coord[0]).toBe(27.5);
  });

  it('keeps every mark inside the plot vertically', () => {
    // The y axis is a fixed 0–1 and the marks are placed as fractions of it. A
    // geometry that reached past either end would be silently clipped, which
    // reads as a shorter tick rather than as a bug.
    const option = bandOption({
      ...POROSITY,
      value: 32.4,
      inSpec: true,
      target: 32.5,
      geometry: HERO_BAND,
    });

    for (const pair of marks(option)) {
      for (const end of pair) {
        expect(end.coord[1]).toBeGreaterThanOrEqual(0);
        expect(end.coord[1]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('centres every mark on the same line', () => {
    // The limits, the target and the reading are all vertical marks of different
    // heights. Centred on anything but a shared midline they read as a ragged
    // row rather than as one instrument.
    const option = bandOption({ ...POROSITY, value: 32.4, inSpec: true, target: 32.5 });

    for (const [from, to] of marks(option)) {
      expect((from.coord[1] + to.coord[1]) / 2).toBeCloseTo(0.5, 6);
    }
  });

  it('gives the hero a thicker track than the dashboard band', () => {
    // One component at two sizes. The hero stands alone at presentation scale;
    // the default stacks four deep on the dashboard, where the same weight would
    // be a row of black bars.
    expect(HERO_BAND.track).toBeGreaterThan(STANDARD_BAND.track);
  });

  it('animates only when it is asked to, and never against the reader’s wish', () => {
    /*
     * ECharts animates on first draw *and* on every `setOption`, so a band that
     * animated by default would redraw itself on every theme change - four at a
     * time on the dashboard. The landing page opts in for the one orchestrated
     * moment the design brief allows; `prefers-reduced-motion` overrides it,
     * because a reader who asked for less motion outranks the page's art
     * direction.
     */
    expect(bandOption({ ...POROSITY, value: 32.4, inSpec: true }).animation).toBe(false);
    expect(bandOption({ ...POROSITY, value: 32.4, inSpec: true, animate: true }).animation).toBe(
      true,
    );
    expect(
      bandOption({ ...POROSITY, value: 32.4, inSpec: true, animate: true, reducedMotion: true })
        .animation,
    ).toBe(false);
  });

  it('leaves no axis, grid or tooltip furniture around the instrument', () => {
    // The band is a drawn readout, not a plot. An axis line, a gridline or a
    // hover tooltip would all be ECharts' defaults arriving uninvited into a
    // 24px-tall graphic.
    const option = bandOption({ ...POROSITY, value: 32.4, inSpec: true });

    expect(option.yAxis).toMatchObject({ show: false, min: 0, max: 1 });
    expect(option.grid).toMatchObject({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(option.tooltip).toMatchObject({ show: false });
  });
});
