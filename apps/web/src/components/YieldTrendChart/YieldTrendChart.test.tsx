import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { YieldTrendChart } from './YieldTrendChart';

import type { CohortReference, TrendPoint } from '@beff/api-client/types';

/**
 * The drawing is `aria-hidden`, so everything assertable about this component
 * is the table it renders beside it — which is the design, not a limitation:
 * the table is the authoritative rendering and the drawing is an index into it.
 * A test that could only inspect the SVG would be testing ECharts.
 */

function point(overrides: Partial<TrendPoint> = {}): TrendPoint {
  return {
    batch_code: 'B-2026-001',
    started_at: '2026-06-01T06:00:00Z',
    cells_started: 1200,
    cells_passed: 816,
    cells_scrapped: 384,
    first_pass_yield_pct: 68,
    scrap_rate_pct: 32,
    capacity_retention_pct: 88.4,
    co2_intensity_kg_per_kwh: 61.2,
    committed_value_lost_eur: 3120.5,
    ...overrides,
  };
}

const benchmark: CohortReference = {
  line_kind: 'pilot',
  sample_size: 34,
  first_pass_yield_p50_pct: 68,
  first_pass_yield_p90_pct: 77.5,
  scrap_rate_p50_pct: 32,
  co2_intensity_p50_kg_per_kwh: 64,
};

const points = [
  point({ batch_code: 'B-2026-001', first_pass_yield_pct: 64.2, cells_passed: 770 }),
  point({
    batch_code: 'B-2026-002',
    started_at: '2026-06-15T06:00:00Z',
    first_pass_yield_pct: 71.8,
    cells_passed: 862,
  }),
];

describe('YieldTrendChart', () => {
  it('names itself so the figure is not anonymous', () => {
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);

    expect(
      screen.getByRole('heading', { name: 'First-pass yield, batch by batch' }),
    ).toBeInTheDocument();
  });

  it('states the size of the cohort it draws a reference line for', () => {
    // A benchmark rendered without its n reads as a measurement of something.
    // With it, it reads as what it is — see `benchmark/cohort.py`.
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);

    expect(screen.getByText(/34 comparable lines/)).toBeInTheDocument();
  });

  it('puts every batch in the table, not just the ones that fit on the axis', () => {
    // The axis thins its labels to whatever fits. The table must not — it is
    // the authoritative rendering, and a reader using it is using it *because*
    // the drawing dropped something.
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);

    expect(screen.getByRole('rowheader', { name: 'B-2026-001' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'B-2026-002' })).toBeInTheDocument();
  });

  it('reports the counts behind each rate, not only the percentage', () => {
    // "812 of 1 140 cells" is the form a process engineer reasons in, and it
    // cannot be recovered from a rounded percentage.
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);

    expect(screen.getByText('770 of 1,200 cells')).toBeInTheDocument();
  });

  it('formats percentages for the reader’s locale', () => {
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);
    expect(screen.getByText('71.8%')).toBeInTheDocument();
  });

  it('renders entirely in German on the German locale', () => {
    // The drawing is aria-hidden, so this caption is the chart's whole
    // announced identity. An English default here would ship silently: axe is
    // indifferent to which language a well-formed string is in, and so is every
    // screenshot.
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="de" />);

    expect(
      screen.getByRole('heading', { name: 'Erstdurchlaufquote je Charge' }),
    ).toBeInTheDocument();
    // Non-breaking space before the sign, and a comma decimal separator.
    expect(screen.getByText('71,8 %')).toBeInTheDocument();
  });

  it('keeps the batches in the order they were produced', () => {
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);

    const rows = within(screen.getByRole('table')).getAllByRole('rowheader');
    expect(rows.map((row) => row.textContent)).toEqual(['B-2026-001', 'B-2026-002']);
  });

  it('renders an empty window without throwing', () => {
    // A configured line that has produced nothing is a real state, not an error.
    expect(() =>
      render(<YieldTrendChart points={[]} benchmark={benchmark} lineKind="pilot" locale="en" />),
    ).not.toThrow();
  });
});
