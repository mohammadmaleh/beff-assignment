import { describe, expect, it } from 'vitest';

import { binPosition, histogram } from './histogram';

describe('histogram', () => {
  it('puts every value in exactly one bin', () => {
    const values = [61, 63.5, 64, 68, 69.9, 70, 71, 78];
    const bins = histogram(values);

    expect(bins.reduce((total, bin) => total + bin.count, 0)).toBe(values.length);
  });

  it('keeps the maximum, which a half-open last bin would drop', () => {
    // The classic off-by-one: every bin is `[start, end)`, so the single
    // largest value falls out of the chart and nothing says so.
    const bins = histogram([10, 20]);
    const last = bins[bins.length - 1];

    expect(last?.end).toBe(20);
    expect(last?.count).toBe(1);
  });

  it('puts the edges on round numbers', () => {
    const bins = histogram([61.3, 77.8]);

    for (const bin of bins) {
      expect(bin.start % (bin.end - bin.start)).toBeCloseTo(0, 6);
    }
  });

  it('stays under the bin ceiling', () => {
    expect(histogram([0, 100], { maxBins: 5 }).length).toBeLessThanOrEqual(5);
    expect(histogram([0, 1000], { maxBins: 8 }).length).toBeLessThanOrEqual(8);
  });

  it('reaches a limit that lies outside the data', () => {
    // A specification limit drawn outside the plot is not clipped, it is
    // invisible - and the chart then stops showing what it is measured against.
    const bins = histogram([70, 75], { include: [40, 80] });

    expect(bins[0]?.start).toBeLessThanOrEqual(40);
    expect(bins[bins.length - 1]?.end).toBeGreaterThanOrEqual(80);
  });

  it('does not count the values it was only asked to reach', () => {
    const bins = histogram([70, 75], { include: [40, 80] });

    expect(bins.reduce((total, bin) => total + bin.count, 0)).toBe(2);
  });

  it('draws a single repeated value as one bar rather than an empty plot', () => {
    const bins = histogram([72, 72, 72]);

    expect(bins).toHaveLength(1);
    expect(bins[0]?.count).toBe(3);
  });

  it('still produces bins when no allowed width can satisfy the ceiling', () => {
    // `maxBins: 0` cannot be met by any width. The honest failure is the
    // coarsest bin available, not an empty array - a caller that asked for
    // something impossible should still get a drawable chart.
    expect(histogram([0, 100], { maxBins: 0 }).length).toBeGreaterThan(0);
  });

  it('is empty for no data, which is a state and not a failure', () => {
    expect(histogram([])).toEqual([]);
    expect(histogram([Number.NaN])).toEqual([]);
  });
});

describe('binPosition', () => {
  const bins = histogram([60, 80], { maxBins: 10 });

  it('places a limit between bars rather than snapping it to one', () => {
    const width =
      (bins[0] as { start: number; end: number }).end - (bins[0] as { start: number }).start;
    const midway = (bins[0] as { start: number }).start + width / 2;

    expect(binPosition(bins, midway)).toBeCloseTo(0, 6);
  });

  it('counts from the centre of the first band, as a category axis does', () => {
    expect(binPosition(bins, (bins[0] as { start: number }).start)).toBeCloseTo(-0.5, 6);
  });

  it('returns null off the axis, so the caller omits the line rather than pinning it to the edge', () => {
    // A limit pinned to the edge of a plot reads as "you are at the limit",
    // which is a lie whenever the limit is somewhere else entirely.
    expect(binPosition(bins, -10)).toBeNull();
    expect(binPosition(bins, 1000)).toBeNull();
    expect(binPosition([], 5)).toBeNull();
  });

  it('refuses a zero-width bin rather than dividing by it', () => {
    // Not reachable from `histogram`, which never emits one - but this is
    // exported, and `Infinity` as a category index draws a rule somewhere no
    // reader could explain.
    expect(binPosition([{ start: 5, end: 5, count: 1 }], 5)).toBeNull();
  });
});
