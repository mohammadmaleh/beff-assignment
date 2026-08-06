/**
 * Binning, on round numbers.
 *
 * ## Why the bin edges are the whole problem
 *
 * A histogram is the one chart where the *drawing decisions* change the answer.
 * Sixty batches binned at 1 point wide look like noise; the same sixty binned
 * at 10 look like a single block. And edges that fall on 63.7 and 66.4 make a
 * reader do arithmetic before they can say anything at all about the shape.
 *
 * So bin width comes from the same allowed-steps idea as `niceBounds`: the
 * tightest round width that keeps the bin count under a ceiling. The edges are
 * then multiples of that width, which is what makes "64 to 66 %" a sentence
 * rather than a range someone has to decode.
 *
 * ## Why limits are an input
 *
 * A distribution is drawn to be read against something - a specification
 * window, a cohort median. If the bins stop short of a limit, the limit is
 * drawn outside the plot and silently disappears, and the chart quietly stops
 * showing the thing it exists to show. Passing them in as `include` extends the
 * range rather than clipping it.
 */

/** Widths a bin is allowed to have, per power of ten. */
const STEPS = [1, 2, 2.5, 5] as const;

function candidateWidths(span: number): number[] {
  const magnitude = Math.floor(Math.log10(Math.max(span, Number.EPSILON)));
  const widths: number[] = [];

  for (let power = magnitude - 2; power <= magnitude + 1; power += 1) {
    for (const step of STEPS) widths.push(step * 10 ** power);
  }

  return widths.sort((a, b) => a - b);
}

export interface Bin {
  /** Inclusive. */
  start: number;
  /** Exclusive, except on the last bin, which has to hold the maximum. */
  end: number;
  count: number;
}

export interface HistogramOptions {
  /**
   * Values the range must reach even though they are not data - a
   * specification limit, a percentile. They are not counted.
   */
  include?: readonly number[];
  /** Ceiling on the number of bins. The lever between noise and one block. */
  maxBins?: number;
}

/**
 * Bin values into round-edged buckets that span the data and everything drawn
 * beside it.
 *
 * Returns `[]` for no finite values - an empty histogram is a legitimate state
 * (a window with no batches yet), and the caller can distinguish it from a
 * broken one.
 */
export function histogram(values: readonly number[], options: HistogramOptions = {}): Bin[] {
  const { include = [], maxBins = 10 } = options;

  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return [];

  const reach = [...finite, ...include.filter((value) => Number.isFinite(value))];
  const low = Math.min(...reach);
  const high = Math.max(...reach);

  const span = high - low;
  const widths = candidateWidths(span === 0 ? 1 : span);
  const width =
    widths.find(
      (candidate) => Math.ceil(high / candidate) - Math.floor(low / candidate) <= maxBins,
    ) ?? widths[widths.length - 1]!;

  const start = Math.floor(low / width) * width;
  // At least one bin: a single repeated value has a zero span and still has to
  // be drawn as something rather than as an empty plot.
  const count = Math.max(1, Math.ceil((high - start) / width));

  return Array.from({ length: count }, (_unused, index) => {
    const binStart = Number((start + index * width).toFixed(6));
    const binEnd = Number((start + (index + 1) * width).toFixed(6));
    const last = index === count - 1;

    return {
      start: binStart,
      end: binEnd,
      count: finite.filter((value) =>
        // The last bin closes on the right, or the maximum value falls out of
        // the histogram entirely - off by one bar, silently, always at the end.
        last ? value >= binStart && value <= binEnd : value >= binStart && value < binEnd,
      ).length,
    };
  });
}

/**
 * Where a value sits on a category axis of bins, as a fractional index.
 *
 * ECharts places a `markLine` on a category axis by index, and a specification
 * limit almost never lands on a bin boundary. Without this the limit snaps to
 * the nearest bar and the chart shows a rule two points from where it actually
 * is - which on a yield window is the difference between in spec and out.
 *
 * The offset of `0.5` is because a category tick is drawn at the *centre* of
 * its band.
 */
export function binPosition(bins: readonly Bin[], value: number): number | null {
  const first = bins[0];
  const last = bins[bins.length - 1];
  if (first === undefined || last === undefined) return null;
  if (value < first.start || value > last.end) return null;

  const width = first.end - first.start;
  if (width <= 0) return null;

  return (value - first.start) / width - 0.5;
}
