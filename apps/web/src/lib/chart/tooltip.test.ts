import { describe, expect, it } from 'vitest';

import { pointAt, seriesTooltip, strong, tooltipHtml } from './tooltip';

const points = ['a', 'b', 'c'];

describe('pointAt', () => {
  it('reads the index out of a single params object', () => {
    // `trigger: 'item'` hands the formatter one object.
    expect(pointAt({ dataIndex: 1 }, points)).toBe('b');
  });

  it('reads the index out of an array of params', () => {
    // `trigger: 'axis'` hands it one per series — for a stacked bar, two.
    expect(pointAt([{ dataIndex: 2 }, { dataIndex: 2 }], points)).toBe('c');
  });

  it('returns undefined rather than throwing on an index the series lacks', () => {
    // A tooltip runs during a hover, inside ECharts' own render loop. An
    // exception there surfaces as a blank chart and a stack trace with no user
    // action attached to it.
    expect(pointAt({ dataIndex: 99 }, points)).toBeUndefined();
  });

  it('returns undefined when there is no index at all', () => {
    expect(pointAt({}, points)).toBeUndefined();
    expect(pointAt(undefined, points)).toBeUndefined();
    expect(pointAt([], points)).toBeUndefined();
  });

  it('handles index zero, which is falsy and the most likely off-by-one', () => {
    expect(pointAt({ dataIndex: 0 }, points)).toBe('a');
  });
});

describe('tooltipHtml', () => {
  it('joins lines with a break', () => {
    expect(tooltipHtml(['one', 'two'])).toBe('one<br>two');
  });

  it('drops empty and falsy entries so a caller can write a conditional inline', () => {
    expect(tooltipHtml(['one', false, null, undefined, '', 'two'])).toBe('one<br>two');
  });

  it('returns an empty string for nothing at all', () => {
    expect(tooltipHtml([])).toBe('');
  });
});

describe('strong', () => {
  it('wraps the line that names what is being read', () => {
    expect(strong('B-2026-001')).toBe('<strong>B-2026-001</strong>');
  });
});

describe('seriesTooltip', () => {
  it('renders the point ECharts asked about', () => {
    const formatter = seriesTooltip(points, (point) => `value: ${point}`);

    expect(formatter({ dataIndex: 1 })).toBe('value: b');
  });

  it('returns an empty string instead of calling render on a missing point', () => {
    // The branch this helper exists for. Inlined in each chart it was four
    // copies of the same guard, and forgetting one is invisible until a hover
    // lands on an index the series does not have — at which point the chart
    // throws inside ECharts' render loop and goes blank.
    let called = false;
    const formatter = seriesTooltip(points, () => {
      called = true;
      return 'rendered';
    });

    expect(formatter({ dataIndex: 99 })).toBe('');
    expect(called).toBe(false);
  });

  it('returns an empty string when ECharts sends no index at all', () => {
    expect(seriesTooltip(points, () => 'rendered')({})).toBe('');
  });
});
