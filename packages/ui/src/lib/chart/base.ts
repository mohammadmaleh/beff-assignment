import type { EChartsOption } from './echarts';
import type { ChartTokens } from './tokens';

/**
 * The option fragments every chart in the system starts from.
 *
 * ECharts' defaults are a different design system: 12px sans-serif, a solid
 * grey axis line, a full grid, a dark tooltip with a shadow, and a categorical
 * palette that is not colourblind-safe. Overriding all of that per chart would
 * mean four chances to get it slightly different, which is precisely how a
 * dashboard ends up with three greys.
 *
 * ## The rules encoded here
 *
 * - **Axes and grid are recessive.** A hairline in `border-default`, ticks in
 *   `text-muted`, and the grid drawn only across the value axis. Gridlines on
 *   both axes make a chart look like a spreadsheet and compete with the marks.
 * - **Text wears text tokens, never the series colour.** A label in the
 *   series' own hue reads as data.
 * - **Tabular figures everywhere**, matching the rest of the app — a tooltip
 *   whose numbers reflow as they change is unreadable while hovering along a
 *   line.
 * - **Motion is off by default and opted into.** See `animation` below.
 */

/** Typeface stack pulled from the app's own type tokens at call time. */
const FONT_FAMILY =
  'var(--type-family-body), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

export interface BaseOptionInput {
  tokens: ChartTokens;
  /**
   * The reader's `prefers-reduced-motion` answer.
   *
   * ECharts animates on first draw *and* on every `setOption`, which for a
   * theme change means every mark in the chart slides to its new colour. The
   * project rule is `transform`/`opacity` only; a library animating an SVG
   * `d` attribute cannot honour that, so for a reader who asked for less
   * motion the honest implementation is not a shorter animation but none.
   */
  reducedMotion: boolean;
}

/** Grid, axis, text and tooltip defaults shared by every chart. */
export function baseOption({ tokens, reducedMotion }: BaseOptionInput): EChartsOption {
  return {
    animation: !reducedMotion,
    animationDuration: 400,
    // The chart's own background stays transparent so it inherits whatever
    // surface the section around it is painted with. `chart-surface` exists for
    // the tooltip, which floats above and needs an opaque ground.
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: FONT_FAMILY,
      fontSize: 12,
      color: tokens['color-text-muted'],
    },
    grid: {
      // `containLabel` lets the plot area shrink to fit its own labels rather
      // than the labels being clipped. German axis labels run ~30% longer than
      // English, and a fixed left inset that fits "Yield" clips "Ausbeute".
      containLabel: true,
      top: 16,
      right: 8,
      bottom: 8,
      left: 8,
    },
    tooltip: {
      backgroundColor: tokens['color-chart-surface'],
      borderColor: tokens['color-border-default'],
      borderWidth: 1,
      padding: [8, 12],
      textStyle: {
        color: tokens['color-text-default'],
        fontFamily: FONT_FAMILY,
        fontSize: 12,
      },
      extraCssText: 'box-shadow: none; border-radius: 2px; font-variant-numeric: tabular-nums;',
    },
  };
}

/**
 * A category axis: batches, process steps — things with names, not positions.
 *
 * Generic in `extra` so the caller's own keys survive into the return type. A
 * plain `Record<string, unknown>` parameter erases them, which makes
 * `categoryAxis(tokens, { data }).data` a type error at every call site that
 * wants to read back what it passed — including the tests that check an
 * override did not clobber a default.
 */
export function categoryAxis<E extends Record<string, unknown>>(
  tokens: ChartTokens,
  extra: E = {} as E,
) {
  return {
    type: 'category' as const,
    axisLine: { lineStyle: { color: tokens['color-border-default'], width: 1 } },
    // Ticks pointing out of a hairline axis are two marks doing one job.
    axisTick: { show: false },
    axisLabel: { color: tokens['color-text-muted'], fontFamily: FONT_FAMILY, fontSize: 11 },
    splitLine: { show: false },
    ...extra,
  };
}

/** A value axis. The gridline lives here, and only here. */
export function valueAxis<E extends Record<string, unknown>>(
  tokens: ChartTokens,
  extra: E = {} as E,
) {
  return {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: tokens['color-text-muted'], fontFamily: FONT_FAMILY, fontSize: 11 },
    splitLine: {
      lineStyle: {
        color: tokens['color-surface-sunken'],
        width: 1,
        // Solid, in the sunken surface. A dashed gridline is a *meaningful*
        // line style in this app — every reference line (spec limit, cohort
        // percentile, target) is dashed, and a dashed grid would make the
        // background argue with the foreground.
        type: 'solid' as const,
      },
    },
    ...extra,
  };
}

/**
 * A dashed reference line: a specification limit, a target, a cohort median.
 *
 * Always dashed and always in a neutral, never in a series colour. That pair of
 * rules is what lets a reader tell a *measurement* from a *rule it is judged
 * against* without being told, and it survives greyscale, colour blindness and
 * a printout — which the colour alone would not.
 */
export function referenceLine(
  tokens: ChartTokens,
  {
    value,
    label,
    strong = false,
    axis = 'y',
  }: {
    value: number;
    label: string;
    strong?: boolean;
    /**
     * Which axis the value is read against — `y` for a horizontal rule across a
     * trend, `x` for a vertical one down a distribution.
     *
     * A histogram measures the same limits as the trend beside it and has to
     * draw them at right angles, and a chart that reimplements the dashed
     * neutral locally is a chart whose limits stop matching everyone else's.
     */
    axis?: 'x' | 'y';
  },
) {
  const shared = {
    lineStyle: {
      color: strong ? tokens['color-band-limit'] : tokens['color-border-default'],
      type: 'dashed' as const,
      width: strong ? 1.5 : 1,
    },
    label: {
      formatter: label,
      // A vertical rule has no "inside end" worth the name — the label would
      // sit on the plot's own top edge. It goes above the line instead.
      position: axis === 'x' ? ('end' as const) : ('insideEndTop' as const),
      color: tokens['color-text-muted'],
      fontFamily: FONT_FAMILY,
      fontSize: 11,
    },
  };

  return axis === 'x' ? { xAxis: value, ...shared } : { yAxis: value, ...shared };
}
