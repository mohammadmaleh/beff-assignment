/**
 * The identity of every figure on the authenticated surface.
 *
 * ## Why the id is a constant
 *
 * `ChartFigure` derives four DOM ids from it — the heading, the tablist's
 * `aria-labelledby`, and one `id`/`aria-controls` pair per panel. They have to
 * be unique on the page, and the failure when they are not is not a crash: two
 * figures claim the same panel, a screen reader announces the wrong one, and
 * every automated check still passes because the markup is well formed. A list
 * in one file is what makes "unique" reviewable.
 *
 * ## Why the CSV stem is beside it
 *
 * It is the same figure named for a different audience — one names it in the
 * accessibility tree, the other on a colleague's desktop three weeks later. The
 * brand prefix lives here rather than inside `DataTable`, which has no business
 * knowing whose product it is rendering.
 */

export const FIGURE_IDS = {
  yieldTrend: 'yield-trend',
  throughput: 'throughput',
  scrapByStep: 'scrap-by-step',
  scrapCost: 'scrap-cost',
  /** Suffixed per parameter — porosity, areal loading, energy density. */
  controlChart: 'control',
  costOfPosition: 'cost-of-position',
} as const;

/** Every export is `beff-…`, so a downloads folder sorts them together. */
const CSV_PREFIX = 'beff';

export const csvName = (stem: string): string => `${CSV_PREFIX}-${stem}`;

export const CSV_NAMES = {
  yieldTrend: csvName('first-pass-yield'),
  throughput: csvName('cells-by-batch'),
  scrapByStep: csvName('scrap-by-step'),
  scrapCost: csvName('committed-value-lost'),
} as const;
