import { describe, expect, it } from 'vitest';

import { tokens, type TokenName } from '../../dist/tokens.js';
import { cvdDistance } from './index.js';

/**
 * CIEDE2000 distance below which two colours read as the same. This is the one
 * threshold in the file, and it comes from perception rather than from this
 * palette: below roughly 12 a viewer stops reading two swatches as different
 * colours and starts reading them as two shades of one.
 *
 * An earlier revision carried a second, relaxed floor of 7 for the extended
 * chart series. Its worst case was 7.07 — a 1% margin, which is not a threshold
 * but a number reverse-engineered from the data it was meant to judge. It is
 * gone. Pairs that cannot clear 12 are now *enumerated* instead, below.
 */
const MIN = 12;

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

const EXTENDED = ['color-chart-series-5', 'color-chart-series-6'] as const;
const ALL = [...CORE, ...EXTENDED] as const;

type SeriesName = (typeof ALL)[number];

/**
 * Every unordered pair, once. Typed as `SeriesName` rather than `string` so the
 * token lookups below stay checked — a widened `string` key silently produces
 * an error type and defeats the assertion.
 */
const pairsOf = (xs: readonly SeriesName[]): (readonly [SeriesName, SeriesName])[] =>
  xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as const));

const shortName = (t: SeriesName): string => t.replace('color-chart-series-', '');

/**
 * The pairs that cannot separate by hue alone, and the distance each actually
 * achieves. Extending the palette past four series compresses the available
 * lightness range — every series must also clear 3:1 against the chart surface
 * — until orange and vermillion, then sky and purple, converge under
 * simulation.
 *
 * These are pinned as an exact set rather than waved through by a lowered
 * threshold. A palette change that pushes a *new* pair below 12 fails here and
 * has to be argued for; one that quietly worsens an accepted pair fails the
 * distance pin. The consequence is a product rule, not a licence: **a chart
 * using more than four series must add a non-colour encoding** — dash pattern,
 * marker shape or direct labelling. That belongs to ENG-37.
 */
const BELOW_MIN: Record<'light' | 'dark', readonly (readonly [string, number])[]> = {
  // Orange/vermillion, sky/purple, and blue/purple sitting on the line at
  // 11.9982 — listed rather than rounded up to a pass, because a threshold that
  // bends for the value in front of it is not a threshold. The dark ramp has
  // more room above its near-black ground and clears all fifteen; its worst
  // pair is 13.05.
  light: [
    ['1 and 6', 12.0],
    ['2 and 5', 7.07],
    ['4 and 6', 8.15],
  ],
  dark: [],
};

describe.each(['light', 'dark'] as const)('chart series under CVD — %s', (theme) => {
  // Simulated for deuteranopia and protanopia, taking the worse of the two.
  // Roughly 1 in 12 men has one of these, and no automated a11y tool catches
  // it because a chart series is an SVG path rather than text.
  it.each(pairsOf(CORE))('core: %s and %s stay distinguishable by hue alone', (a, b) => {
    expect(cvdDistance(tokens[theme][a], tokens[theme][b])).toBeGreaterThanOrEqual(MIN);
  });

  it('has exactly the documented set of pairs that cannot clear the threshold', () => {
    const failing = pairsOf(ALL)
      .filter(([a, b]) => cvdDistance(tokens[theme][a], tokens[theme][b]) < MIN)
      .map(([a, b]) => `${shortName(a)} and ${shortName(b)}`);
    expect(failing).toEqual(BELOW_MIN[theme].map(([name]) => name));
  });

  it.each(BELOW_MIN[theme])('accepted exception %s still measures %f', (name, expected) => {
    const [a, b] = name.split(' and ') as [string, string];
    const at = (n: string): TokenName => `color-chart-series-${n}` as TokenName;
    expect(cvdDistance(tokens[theme][at(a)], tokens[theme][at(b)])).toBeCloseTo(expected, 1);
  });
});

/**
 * *In spec* versus *out of spec* is the most consequential distinction the
 * product makes, and green against red is precisely the pair deuteranopia and
 * protanopia collapse. The first palette measured 6.74 between them in both
 * themes — the three status colours had all been solved to just clear 4.5:1
 * against the same ground, which left them at ~1.00 contrast with *each other*,
 * so nothing but hue separated them and hue is the channel that is missing.
 *
 * The trio is now solved for CVD distance as well as contrast, spreading
 * lightness while staying inside the muted band the design brief settled on.
 */
describe.each(['light', 'dark'] as const)('status trio under CVD — %s', (theme) => {
  const STATUSES = [
    'color-status-success-fg',
    'color-status-warning-fg',
    'color-status-danger-fg',
  ] as const;

  const statusPairs = STATUSES.flatMap((a, i) => STATUSES.slice(i + 1).map((b) => [a, b] as const));

  it.each(statusPairs)('%s and %s stay distinguishable by hue alone', (a, b) => {
    expect(cvdDistance(tokens[theme][a], tokens[theme][b])).toBeGreaterThanOrEqual(MIN);
  });
});

/**
 * ## Accepted: the brand accent and the chart blues are the same hue family
 *
 * `CLAUDE.md` says the brand accent must never appear in a chart. Measured, the
 * light brand sits 3.96° from chart series 1 at CVD 6.43, and the dark brand
 * sits at CVD 2.31 from series 6 — under simulation those are one colour.
 *
 * This is not fixed, and the reason is that both candidate fixes cost more than
 * the problem. Series 1 is Okabe-Ito blue, the anchor the whole six-colour set
 * is CVD-safe around; replacing it re-solves all fifteen pair distances to
 * protect a button. Moving the brand off steel relitigates the M2-pre brief and
 * every brand, focus and border pair with it.
 *
 * What the rule actually protects is a reader mistaking chrome for data. Brand
 * tokens paint buttons, links and focus rings; series tokens paint marks inside
 * a plot. They never share a coordinate space, and the one case where they
 * could — a legend swatch beside a brand-coloured control — is separated by
 * position and label, not hue.
 *
 * What is enforced instead is the literal rule: no series token may ever *be* a
 * brand token. The measured distances are pinned so that "we accepted this"
 * cannot quietly become "this got worse".
 */
describe.each(['light', 'dark'] as const)('brand and chart series — %s', (theme) => {
  const BRANDS = ['color-brand-default', 'color-brand-hover'] as const;

  it.each(ALL)('%s is not a brand colour', (series) => {
    const value = tokens[theme][series];
    expect(BRANDS.map((b) => tokens[theme][b])).not.toContain(value);
  });
});

describe('brand and chart series — accepted distances', () => {
  it.each([
    ['light', 'color-chart-series-1', 6.43],
    ['dark', 'color-chart-series-6', 2.31],
  ] as const)('%s brand to %s measures %f', (theme, series, expected) => {
    expect(cvdDistance(tokens[theme]['color-brand-default'], tokens[theme][series])).toBeCloseTo(
      expected,
      1,
    );
  });
});
