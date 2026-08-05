import { describe, expect, it } from 'vitest';

import { formatters } from '@/lib/format';

import { throughputTooltip } from './ThroughputChart';

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

const copy = {
  seriesPassed: 'Passed end-of-line',
  seriesScrapped: 'Scrapped',
  columnStarted: 'Cells started',
};

describe('throughputTooltip', () => {
  it('shows all three counts, not just the hovered segment', () => {
    // A stacked bar answers "how much of this run was lost" only if the whole
    // run is visible. One segment's count makes the reader do the arithmetic.
    const html = throughputTooltip(point, formatters('en'), copy);

    expect(html).toContain('Passed end-of-line: 812');
    expect(html).toContain('Scrapped: 328');
    expect(html).toContain('Cells started: 1,140');
  });

  it('reports counts that add up', () => {
    expect(point.cells_passed + point.cells_scrapped).toBe(point.cells_started);
  });

  it('names the batch in bold', () => {
    expect(throughputTooltip(point, formatters('en'), copy)).toMatch(
      /^<strong>B-2026-041<\/strong>/,
    );
  });

  it('groups thousands in the reader’s locale', () => {
    expect(throughputTooltip(point, formatters('de'), copy)).toContain('1.140');
  });
});
