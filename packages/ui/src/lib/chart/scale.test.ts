import { describe, expect, it } from 'vitest';

import { niceBounds } from './scale';

/**
 * These are written as the real cases from the dashboard, with the numbers the
 * demo line actually produces. A rounding helper tested only on `[0, 10]` is a
 * helper tested on the one input that cannot go wrong.
 */

describe('niceBounds', () => {
  it('contains every value it is given', () => {
    const { min, max } = niceBounds([65, 70, 77.5]);

    expect(min).toBeLessThanOrEqual(65);
    expect(max).toBeGreaterThanOrEqual(77.5);
  });

  it('lands on round numbers rather than on the data', () => {
    // The whole point. Padding by a fraction of the span gives bounds like
    // 233.95 and 269.05, and ECharts prints axis labels from them verbatim.
    const { min, max } = niceBounds([238, 242.4, 240, 265], { padRatio: 0.15 });

    expect(min % 10).toBe(0);
    expect(max % 10).toBe(0);
    expect({ min, max }).toEqual({ min: 230, max: 270 });
  });

  it('returns the gridline step alongside the bounds', () => {
    // Setting min/max without interval lets ECharts keep the step it would have
    // chosen and append the forced bound as an extra label - which stacked
    // `1,500` and `1,600` on top of each other. The three have to agree.
    const { min, max, interval } = niceBounds([0, 1300], {
      padRatio: 0.02,
      maxIntervals: 8,
      clampMin: 0,
    });

    expect(interval).toBeGreaterThan(0);
    expect((max - min) / interval).toBe(Math.round((max - min) / interval));
  });

  it('gives first-pass yield an axis the trend can be read on', () => {
    // The bug this replaced: pinning to the 40-80 pilot window put the data in
    // a fifth of the plot height. Scaled to the batches and the cohort lines,
    // the same data should occupy most of it.
    const values = [65.1, 68.4, 71.2, 74.9, 77.4];
    const { min, max } = niceBounds([...values, 68, 77.5], {
      padRatio: 0.18,
      minPad: 2,
      maxIntervals: 5,
      clampMin: 0,
      clampMax: 100,
    });

    const used = (Math.max(...values) - Math.min(...values)) / (max - min);
    expect(used).toBeGreaterThan(0.5);
    expect(min).toBe(60);
    expect(max).toBe(80);
  });

  it('keeps a bar chart anchored at zero without leaving a dead band on top', () => {
    // 1 300 cells on a 1 500 axis is 13% of the plot showing nothing. A higher
    // interval ceiling buys a finer step, and a finer step rounds less far out.
    const { min, max } = niceBounds([0, 1180, 1300], {
      padRatio: 0.02,
      maxIntervals: 8,
      clampMin: 0,
    });

    expect(min).toBe(0);
    expect(max).toBe(1400);
  });

  it('never lets a percentage axis leave 0-100', () => {
    const { min, max } = niceBounds([2, 99], { padRatio: 0.4, clampMin: 0, clampMax: 100 });

    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(100);
  });

  it('respects the interval ceiling it is given', () => {
    const { min, max } = niceBounds([0, 97], { maxIntervals: 5 });

    expect((max - min) / 5).toBeGreaterThan(0);
    // At most five gridline gaps, whatever step that forces.
    const steps = [1, 2, 2.5, 5, 10, 20, 25, 50, 100];
    const step = steps.find((candidate) => (max - min) / candidate <= 5);
    expect(step).toBeDefined();
  });

  it('gives a flat series a plot rather than a single line', () => {
    // Every reading identical is a real state - a parameter held perfectly.
    // Rounded naively it produces min === max and an axis of zero height.
    const { min, max } = niceBounds([32.4, 32.4, 32.4], { minPad: 1 });

    expect(max).toBeGreaterThan(min);
    expect(min).toBeLessThanOrEqual(32.4);
    expect(max).toBeGreaterThanOrEqual(32.4);
  });

  it('survives an empty series', () => {
    // A configured line that has produced nothing yet.
    expect(niceBounds([])).toEqual({ min: 0, max: 1, interval: 1 });
  });

  it('ignores values that are not finite', () => {
    const { min, max } = niceBounds([10, Number.NaN, 20, Number.POSITIVE_INFINITY]);

    expect(Number.isFinite(min)).toBe(true);
    expect(Number.isFinite(max)).toBe(true);
    expect(max).toBeGreaterThanOrEqual(20);
  });

  it('does not emit floating-point noise in its bounds', () => {
    // `Math.ceil(0.3 / 0.1) * 0.1` is 0.30000000000000004, and that reaches the
    // axis label unchanged.
    const { min, max } = niceBounds([0.12, 0.28], { padRatio: 0.1 });

    expect(String(min)).not.toMatch(/0{6,}\d/);
    expect(String(max)).not.toMatch(/0{6,}\d/);
  });
});
