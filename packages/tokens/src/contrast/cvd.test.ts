import { describe, expect, it } from 'vitest';

import { tokens } from '../../dist/tokens.js';
import { cvdDistance } from './index.js';

/**
 * Series 1–4 are the colour-vision-safe core: any chart may use these and rely
 * on hue alone to separate them.
 */
const CORE = [
  'color-chart-series-1',
  'color-chart-series-2',
  'color-chart-series-3',
  'color-chart-series-4',
] as const;

/**
 * Series 5–6 extend the palette past what hue alone can carry. Forcing every
 * series to clear 3:1 against a near-white surface compresses the available
 * lightness range, and beyond four the remaining colours converge under
 * simulation — orange and vermillion in particular.
 */
const EXTENDED = ['color-chart-series-5', 'color-chart-series-6'] as const;
const ALL = [...CORE, ...EXTENDED] as const;

/** CIEDE2000 distance below which two colours read as the same. */
const CORE_MIN = 12;

/**
 * The floor the full six achieve. It is deliberately lower, and it is only
 * acceptable because this project's rule is that colour is never the only
 * signal — a chart using more than four series must also separate them by
 * dash pattern, marker shape or direct labelling. That requirement belongs to
 * ENG-37 and is recorded in the roadmap; this number is not a licence to skip
 * it.
 */
const EXTENDED_MIN = 7;

type SeriesName = (typeof ALL)[number];

/**
 * Every unordered pair, once. Typed as `SeriesName` rather than `string` so the
 * token lookups below stay checked — a widened `string` key silently produces
 * an error type and defeats the assertion.
 */
const pairsOf = (xs: readonly SeriesName[]): (readonly [SeriesName, SeriesName])[] =>
  xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as const));

describe.each(['light', 'dark'] as const)('chart series under CVD — %s', (theme) => {
  // Simulated for deuteranopia and protanopia, taking the worse of the two.
  // Roughly 1 in 12 men has one of these, and no automated a11y tool catches
  // it because a chart series is an SVG path rather than text.
  it.each(pairsOf(CORE))('core: %s and %s stay distinguishable by hue alone', (a, b) => {
    expect(cvdDistance(tokens[theme][a], tokens[theme][b])).toBeGreaterThanOrEqual(CORE_MIN);
  });

  it.each(pairsOf(ALL))('extended: %s and %s remain separable', (a, b) => {
    expect(cvdDistance(tokens[theme][a], tokens[theme][b])).toBeGreaterThanOrEqual(EXTENDED_MIN);
  });
});
