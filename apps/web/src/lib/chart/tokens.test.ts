import { describe, expect, it } from 'vitest';

import { readChartTokens } from './tokens';

/**
 * `readChartTokens` is the seam between the cascade and the canvas, and it has
 * exactly one interesting failure: a colour string ECharts cannot parse. SVG
 * and canvas both *silently ignore* an unparseable fill, so the chart renders
 * with invisible marks and nothing errors anywhere — no console warning, no
 * exception, just an empty plot area that looks like a data problem.
 */

function withCustomProperties(declarations: string): HTMLElement {
  const element = document.createElement('div');
  element.setAttribute('style', declarations);
  document.body.append(element);
  return element;
}

describe('readChartTokens', () => {
  it('reads a custom property off the element', () => {
    const element = withCustomProperties('--color-chart-series-1: #0071b1');

    expect(readChartTokens(element)['color-chart-series-1']).toBe('#0071b1');
  });

  it('trims the whitespace a declaration carries', () => {
    // `getPropertyValue` returns the declaration's text, so `--x: #fff` comes
    // back with a leading space. ECharts passes it to the renderer verbatim and
    // the renderer drops the mark rather than complaining.
    const element = withCustomProperties('--color-chart-series-1:   #0071b1  ');

    expect(readChartTokens(element)['color-chart-series-1']).toBe('#0071b1');
  });

  it('falls back to a real colour when a property is missing', () => {
    // Never the empty string. A chart painted with `''` has no marks at all,
    // and the fallback being the light theme's own value means the worst case
    // is a wrong theme for one frame rather than a blank chart forever.
    const element = withCustomProperties('');
    const tokens = readChartTokens(element);

    expect(tokens['color-chart-series-1']).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tokens['color-text-default']).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('resolves every token a chart is allowed to draw with', () => {
    const tokens = readChartTokens(withCustomProperties(''));

    // No empty values anywhere — a single unresolved token is one invisible
    // series, one missing axis or one unreadable tooltip.
    expect(Object.values(tokens).every((value) => value.length > 0)).toBe(true);
  });

  it('keeps the six series colours distinct', () => {
    // They come from the Okabe-Ito set precisely so adjacent series stay
    // distinguishable under the common colour vision deficiencies. Two slots
    // resolving to the same hex would silently undo that.
    const tokens = readChartTokens(withCustomProperties(''));
    const series = [
      tokens['color-chart-series-1'],
      tokens['color-chart-series-2'],
      tokens['color-chart-series-3'],
      tokens['color-chart-series-4'],
      tokens['color-chart-series-5'],
      tokens['color-chart-series-6'],
    ];

    expect(new Set(series).size).toBe(series.length);
  });
});
