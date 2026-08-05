import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readChartTokens, useChartTokens } from './tokens';

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

/**
 * The hook is where the seam has to *stay* correct.
 *
 * A chart is painted, not styled: the cascade cannot reach it, so it holds a
 * copy of the palette and that copy goes stale the moment the theme moves. Two
 * things move it, and they are genuinely different events — the toggle writes
 * `data-theme` on `<html>`, and an OS on a sunset schedule changes the computed
 * value while touching no attribute at all. A hook that watched only the first
 * leaves every chart in the old palette on a surface that has already flipped,
 * which is not subtle: dark axis labels on a dark ground.
 */
function stubSchemeQuery() {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: false,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
    addListener: () => {},
    removeListener: () => {},
  }));

  return {
    change() {
      for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent);
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme');
});

describe('useChartTokens', () => {
  it('resolves the palette the page is actually painted with', async () => {
    stubSchemeQuery();
    document.documentElement.style.setProperty('--color-chart-series-1', '#0071b1');

    const { result } = renderHook(() => useChartTokens());

    await waitFor(() => {
      expect(result.current['color-chart-series-1']).toBe('#0071b1');
    });
  });

  it('re-reads when the toggle pins a theme on the root element', async () => {
    stubSchemeQuery();
    document.documentElement.style.setProperty('--color-chart-series-1', '#0071b1');
    const { result } = renderHook(() => useChartTokens());
    await waitFor(() => {
      expect(result.current['color-chart-series-1']).toBe('#0071b1');
    });

    // What `ThemeToggle` does: a new value under a new `data-theme`. The
    // attribute is the signal; the property is what the cascade resolved.
    document.documentElement.style.setProperty('--color-chart-series-1', '#4aa3d8');
    document.documentElement.setAttribute('data-theme', 'dark');

    await waitFor(() => {
      expect(result.current['color-chart-series-1']).toBe('#4aa3d8');
    });
  });

  it('re-reads when the OS crosses its own light/dark schedule', async () => {
    // No attribute changes here at all — this is the path a `MutationObserver`
    // alone cannot see, and the one a reader who never touched the toggle is on.
    const media = stubSchemeQuery();
    document.documentElement.style.setProperty('--color-chart-series-1', '#0071b1');
    const { result } = renderHook(() => useChartTokens());
    await waitFor(() => {
      expect(result.current['color-chart-series-1']).toBe('#0071b1');
    });

    document.documentElement.style.setProperty('--color-chart-series-1', '#4aa3d8');
    act(() => {
      media.change();
    });

    expect(result.current['color-chart-series-1']).toBe('#4aa3d8');
  });

  it('stops listening when the chart goes away', () => {
    // Six charts per dashboard visit, each holding a media listener and a
    // MutationObserver on <html>, is a leak that reads as "the page gets slower
    // the longer it is left open" rather than as a bug in any one chart.
    const media = stubSchemeQuery();
    const { unmount } = renderHook(() => useChartTokens());

    expect(media.listenerCount).toBe(1);
    unmount();
    expect(media.listenerCount).toBe(0);
  });
});
