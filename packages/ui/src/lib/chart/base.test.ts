import { describe, expect, it } from 'vitest';

import { baseOption, categoryAxis, referenceLine, valueAxis } from './base';
import { readChartTokens } from './tokens';

const tokens = readChartTokens(document.documentElement);

describe('baseOption', () => {
  it('turns animation off entirely for a reader who asked for less motion', () => {
    // Not a shorter animation. ECharts tweens SVG path data, which the project
    // rule (transform and opacity only) cannot be applied to — so the honest
    // implementation of "reduce" here is "none".
    expect(baseOption({ tokens, reducedMotion: true }).animation).toBe(false);
  });

  it('animates for everyone else', () => {
    expect(baseOption({ tokens, reducedMotion: false }).animation).toBe(true);
  });

  it('leaves the chart background transparent', () => {
    // So the chart inherits whichever surface its section is painted with. A
    // chart that paints its own base colour shows as a pale rectangle the
    // moment it is placed on the calibration ground.
    expect(baseOption({ tokens, reducedMotion: false }).backgroundColor).toBe('transparent');
  });

  it('lets the plot area shrink to fit its own labels', () => {
    // German axis labels run ~30% longer than English. A fixed inset that fits
    // "Yield" clips "Ausbeute".
    const option = baseOption({ tokens, reducedMotion: false });
    const grid = option.grid as { containLabel?: boolean };

    expect(grid.containLabel).toBe(true);
  });

  it('gives the tooltip tabular figures', () => {
    // Numbers that reflow as they change are unreadable while tracking along a
    // line, which is the only time a tooltip is on screen.
    const option = baseOption({ tokens, reducedMotion: false });
    const tooltip = option.tooltip as { extraCssText?: string };

    expect(tooltip.extraCssText).toContain('tabular-nums');
  });
});

describe('axes', () => {
  it('draws the gridline on the value axis only', () => {
    // Gridlines on both axes make a chart look like a spreadsheet and compete
    // with the marks for attention.
    expect(valueAxis(tokens).splitLine.lineStyle.color).toBe(tokens['color-surface-sunken']);
    expect(categoryAxis(tokens).splitLine.show).toBe(false);
  });

  it('draws the gridline solid, never dashed', () => {
    // Dashed is a *meaningful* line style in this app — every reference line is
    // dashed. A dashed grid would make the background argue with the foreground.
    expect(valueAxis(tokens).splitLine.lineStyle.type).toBe('solid');
  });

  it('hides axis ticks, which are a second mark doing the axis line’s job', () => {
    expect(categoryAxis(tokens).axisTick.show).toBe(false);
    expect(valueAxis(tokens).axisTick.show).toBe(false);
  });

  it('labels axes in a text token, never in a series colour', () => {
    expect(categoryAxis(tokens).axisLabel.color).toBe(tokens['color-text-muted']);
    expect(valueAxis(tokens).axisLabel.color).toBe(tokens['color-text-muted']);
  });

  it('accepts overrides without losing the defaults they do not mention', () => {
    const axis = categoryAxis(tokens, { data: ['a', 'b'] });

    expect(axis.data).toEqual(['a', 'b']);
    expect(axis.splitLine.show).toBe(false);
  });
});

describe('referenceLine', () => {
  const line = referenceLine(tokens, { value: 68, label: 'Cohort median' });

  it('is always dashed', () => {
    // This, with the neutral below, is what lets a reader tell a measurement
    // from a rule it is judged against — without a legend, and in greyscale.
    expect(line.lineStyle.type).toBe('dashed');
  });

  it('is always a neutral, never a series colour', () => {
    const seriesColours = [
      tokens['color-chart-series-1'],
      tokens['color-chart-series-2'],
      tokens['color-chart-series-3'],
      tokens['color-chart-series-4'],
      tokens['color-chart-series-5'],
      tokens['color-chart-series-6'],
    ];

    expect(seriesColours).not.toContain(line.lineStyle.color);
  });

  it('carries its label as text, so the line is never unexplained', () => {
    expect(line.label.formatter).toBe('Cohort median');
    expect(line.label.color).toBe(tokens['color-text-muted']);
  });

  it('draws a specification limit more strongly than a cohort percentile', () => {
    // A limit is a rule the line is held to; a percentile is context. Same
    // dashed-neutral family, different weight, so the hierarchy is visible.
    const limit = referenceLine(tokens, { value: 40, label: 'Lower limit', strong: true });

    expect(limit.lineStyle.width).toBeGreaterThan(line.lineStyle.width);
  });
});
