/**
 * Axis bounds that land on round numbers.
 *
 * ## Why this is not left to ECharts
 *
 * ECharts picks its own nice bounds, and picks them well — but only when it is
 * allowed to choose both ends. Every chart here needs to *include* something
 * that is not in the data: a specification limit, a cohort percentile, zero.
 * The moment a chart sets `min` or `max` by hand it opts out of the nice-number
 * pass entirely, and the axis ends up reading `231` and `269.05`.
 *
 * ## Why not just pin the axis to the specification window
 *
 * That was the first attempt, and it is wrong for a reason worth recording. A
 * pilot line's first-pass yield window is 40–80%, so pinning the axis to it put
 * the shaded band across 73% of the plot and squeezed two months of real
 * variation — 65% to 77% — into a fifth of the height. The chart shouted "in
 * spec" and whispered the trend, which is backwards for a chart whose entire
 * job is the trend.
 *
 * The rule it was protecting is still real: an axis scaled to the data alone
 * makes a two-point wobble fill the plot and look like a collapse. So the
 * answer is neither extreme. Scale to the data *and* whatever reference lines
 * are drawn beside it, pad it, and round the result outward.
 */

/**
 * Steps an axis is allowed to use, per power of ten.
 *
 * `2.5` earns its place on percentage axes, where 2.5-point gridlines are
 * ordinary. Anything outside this set produces labels like `37` or `140` that a
 * reader has to do arithmetic on.
 */
const STEPS = [1, 2, 2.5, 5] as const;

/** Every allowed step from well below the span to well above it, ascending. */
function candidateSteps(span: number): number[] {
  const magnitude = Math.floor(Math.log10(Math.max(span, Number.EPSILON)));
  const steps: number[] = [];

  for (let power = magnitude - 2; power <= magnitude + 1; power += 1) {
    for (const step of STEPS) steps.push(step * 10 ** power);
  }

  return steps.sort((a, b) => a - b);
}

export interface BoundsOptions {
  /** Fraction of the data span added at each end before rounding. */
  padRatio?: number;
  /** Floor on that padding, in the axis's own unit. Stops a flat series collapsing. */
  minPad?: number;
  /**
   * Most gridlines the axis may show.
   *
   * The lever that decides how much dead space is tolerated above a bar chart.
   * A low ceiling forces a coarse step, and a coarse step rounds further out —
   * which is exactly how a 1 300-cell maximum ends up on a 1 500 axis.
   */
  maxIntervals?: number;
  /** Hard limits. A percentage cannot exceed 100; a cell count cannot go below 0. */
  clampMin?: number;
  clampMax?: number;
}

export interface Bounds {
  min: number;
  max: number;
  /**
   * The gridline step, named as ECharts names it so `...bounds` spreads whole.
   *
   * Returning it is not a convenience. Setting `min`/`max` by hand without
   * `interval` leaves ECharts free to keep the step *it* would have chosen and
   * to append the forced bound as an extra label — which put `1,500` and
   * `1,600` on top of each other at the top of the throughput axis. The two
   * numbers have to be decided together or they disagree.
   */
  interval: number;
}

/**
 * Round bounds that contain every value passed in.
 *
 * Pass the reference lines as well as the data — a limit or a percentile drawn
 * outside the axis is not merely clipped, it is invisible, and the chart then
 * silently stops showing what it is measured against.
 */
export function niceBounds(values: readonly number[], options: BoundsOptions = {}): Bounds {
  const {
    padRatio = 0.15,
    minPad = 0,
    maxIntervals = 5,
    clampMin = Number.NEGATIVE_INFINITY,
    clampMax = Number.POSITIVE_INFINITY,
  } = options;

  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 1, interval: 1 };

  const low = Math.min(...finite);
  const high = Math.max(...finite);
  const pad = Math.max((high - low) * padRatio, minPad);

  const paddedLow = Math.max(clampMin, low - pad);
  const paddedHigh = Math.min(clampMax, high + pad);

  // The smallest step that keeps the gridline count at or under the ceiling.
  // Ascending, so this is the tightest axis the caller's tolerance allows.
  const span = paddedHigh - paddedLow;
  const steps = candidateSteps(span);
  const step =
    steps.find(
      (candidate) =>
        Math.ceil(paddedHigh / candidate) - Math.floor(paddedLow / candidate) <= maxIntervals,
    ) ?? steps[steps.length - 1];

  if (step === undefined)
    return { min: paddedLow, max: paddedHigh, interval: paddedHigh - paddedLow };

  const min = Math.max(clampMin, Math.floor(paddedLow / step) * step);
  const max = Math.min(clampMax, Math.ceil(paddedHigh / step) * step);

  // A series with no variation at all rounds to a zero-height axis, which
  // ECharts renders as a single line through the middle of an empty plot.
  if (max <= min) return { min: min - step, max: min + step, interval: step };

  // Floating-point tidy-up: `Math.ceil(0.3 / 0.1) * 0.1` is 0.30000000000000004,
  // and ECharts prints axis labels from these numbers verbatim.
  return { min: Number(min.toFixed(6)), max: Number(max.toFixed(6)), interval: step };
}
