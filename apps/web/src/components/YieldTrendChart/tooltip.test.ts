import { describe, expect, it } from 'vitest';

import { formatters } from '@/lib/format';

import { yieldTooltip } from './YieldTrendChart';

import type { TrendPoint } from '@beff/api-client/types';

const point: TrendPoint = {
  batch_code: 'B-2026-041',
  started_at: '2026-07-14T06:00:00Z',
  cells_started: 1140,
  cells_passed: 812,
  cells_scrapped: 328,
  first_pass_yield_pct: 71.23,
  scrap_rate_pct: 28.77,
  capacity_retention_pct: 88.4,
  co2_intensity_kg_per_kwh: 61.2,
  committed_value_lost_eur: 3120.5,
};

const copy = { seriesMeasured: 'This line', tooltipCells: '{passed} of {started} cells' };

describe('yieldTooltip', () => {
  it('names the batch first, in bold', () => {
    // The batch code is the thing an engineer takes away from the hover - it is
    // what they type into the MES to go and look at the run.
    expect(yieldTooltip(point, formatters('en'), copy)).toMatch(/^<strong>B-2026-041<\/strong>/);
  });

  it('reports the counts as well as the rate', () => {
    // Not recoverable from the percentage: 71.2% of 1 140 rounds to 811, and
    // the batch passed 812.
    expect(yieldTooltip(point, formatters('en'), copy)).toContain('812 of 1,140 cells');
  });

  it('formats the rate for the reader’s locale', () => {
    expect(yieldTooltip(point, formatters('en'), copy)).toContain('This line: 71.2%');
    // A non-breaking space before the sign, which is what German requires and
    // what a template literal cannot produce.
    expect(yieldTooltip(point, formatters('de'), copy)).toContain('71,2 %');
  });

  it('gives the date in full, where there is room to be unambiguous', () => {
    expect(yieldTooltip(point, formatters('en'), copy)).toContain('2026');
  });

  it('separates its lines with breaks rather than running them together', () => {
    expect(yieldTooltip(point, formatters('en'), copy).split('<br>')).toHaveLength(4);
  });
});
