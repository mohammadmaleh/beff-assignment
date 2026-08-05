'use client';

import { useEffect, useState } from 'react';

import { DARK_SCHEME_QUERY } from '../media/index';

/**
 * The design tokens a chart is allowed to draw with, resolved at runtime.
 *
 * ## Why these are read from the DOM and not imported
 *
 * `@beff/tokens` ships a `hex` export, and importing it would be one line.
 * It would also be a second source of truth: the page is painted from
 * `tokens.css`, and a chart painted from `tokens.hex.json` agrees with it only
 * as long as nobody edits one without rebuilding the other. Worse, the JSON is
 * keyed by theme, so the chart would have to *decide* which theme it is in —
 * duplicating logic that CSS already performs correctly, including the
 * `prefers-color-scheme` path where no `data-theme` attribute exists at all.
 *
 * Reading the computed custom properties off `<html>` inverts that. The
 * cascade has already resolved which theme applies and why; this just asks it.
 *
 * ## Why it re-reads
 *
 * Two things change the answer, and both must be watched or the charts stay
 * the old colour on a surface that has already flipped:
 *
 * - the reader presses the theme toggle, which sets `data-theme` on `<html>`
 * - the OS crosses its light/dark schedule, which changes nothing in the DOM
 *   and everything in the computed value
 *
 * `ThemeToggle` handles exactly this pair for its own icon. A chart is a canvas
 * and cannot inherit from CSS, so it has to be told.
 */

/** Every custom property a chart reads, without the `--` prefix. */
const TOKEN_NAMES = [
  'color-chart-surface',
  'color-chart-series-1',
  'color-chart-series-2',
  'color-chart-series-3',
  'color-chart-series-4',
  'color-chart-series-5',
  'color-chart-series-6',
  'color-text-default',
  'color-text-muted',
  'color-border-default',
  'color-surface-base',
  'color-surface-raised',
  'color-surface-sunken',
  'color-band-track',
  'color-band-range',
  'color-band-limit',
  'color-band-tick',
  'color-status-success-fg',
  'color-status-warning-fg',
  'color-status-danger-fg',
] as const;

export type ChartTokenName = (typeof TOKEN_NAMES)[number];
export type ChartTokens = Record<ChartTokenName, string>;

/**
 * Server-render values.
 *
 * The light theme's own hexes, not empty strings. A chart mounted with `''`
 * everywhere paints black-on-black for one frame; these are wrong only for a
 * reader in dark mode, and only until the effect below runs.
 */
const FALLBACK: ChartTokens = {
  'color-chart-surface': '#faf8f5',
  'color-chart-series-1': '#0071b1',
  'color-chart-series-2': '#c58000',
  'color-chart-series-3': '#029e72',
  'color-chart-series-4': '#3798cb',
  'color-chart-series-5': '#d45e00',
  'color-chart-series-6': '#c775a3',
  'color-text-default': '#1c1a17',
  'color-text-muted': '#524f4c',
  'color-border-default': '#686662',
  'color-surface-base': '#faf8f5',
  'color-surface-raised': '#f0eeeb',
  'color-surface-sunken': '#e0ddda',
  'color-band-track': '#e0ddda',
  'color-band-range': '#686662',
  'color-band-limit': '#3a3834',
  'color-band-tick': '#1c1a17',
  'color-status-success-fg': '#407d64',
  'color-status-warning-fg': '#9d5d03',
  'color-status-danger-fg': '#892218',
};

/** Resolve every token in one `getComputedStyle` call rather than twenty. */
export function readChartTokens(element: Element): ChartTokens {
  const computed = getComputedStyle(element);
  const resolved = {} as ChartTokens;

  for (const name of TOKEN_NAMES) {
    // `.trim()` is not cosmetic: `getPropertyValue` returns the declaration's
    // text, and a token written as `--x: #fff;` comes back with a leading
    // space. ECharts passes the string to the canvas verbatim, and canvas
    // silently ignores a colour it cannot parse — producing a chart with
    // invisible marks and no error anywhere.
    resolved[name] = computed.getPropertyValue(`--${name}`).trim() || FALLBACK[name];
  }

  return resolved;
}

/** The resolved tokens, kept in step with the theme. */
export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(FALLBACK);

  useEffect(() => {
    const root = document.documentElement;
    const sync = (): void => {
      setTokens(readChartTokens(root));
    };

    sync();

    // The toggle writes `data-theme` here. Scoped to that one attribute so an
    // unrelated class change on <html> does not re-read twenty properties.
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    // And the OS-schedule path, which touches no attribute at all.
    const query = window.matchMedia(DARK_SCHEME_QUERY);
    query.addEventListener('change', sync);

    return () => {
      observer.disconnect();
      query.removeEventListener('change', sync);
    };
  }, []);

  return tokens;
}
