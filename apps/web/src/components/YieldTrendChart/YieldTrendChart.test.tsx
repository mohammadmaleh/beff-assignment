import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { captureCsvDownload } from '@/test/csvDownload';

import { YieldTrendChart } from './YieldTrendChart';

import type { CohortReference, TrendPoint } from '@beff/api-client/types';

/**
 * The drawing is `aria-hidden`, so everything assertable about this component
 * is the table it renders beside it - which is the design, not a limitation:
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

/** The table is a panel behind the "Table" tab now, not open by default. */
async function openTable(): Promise<void> {
  await userEvent.click(screen.getByRole('tab', { name: 'Table' }));
}

describe('YieldTrendChart', () => {
  it('names itself so the figure is not anonymous', () => {
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);

    expect(
      screen.getByRole('heading', { name: 'First-pass yield, batch by batch' }),
    ).toBeInTheDocument();
  });

  it('states the size of the cohort it draws a reference line for', () => {
    // A benchmark rendered without its n reads as a measurement of something.
    // With it, it reads as what it is - see `benchmark/cohort.py`.
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);

    expect(screen.getByText(/34 comparable lines/)).toBeInTheDocument();
  });

  it('puts every batch in the table, not just the ones that fit on the axis', async () => {
    // The axis thins its labels to whatever fits. The table must not - it is
    // the authoritative rendering, and a reader using it is using it *because*
    // the drawing dropped something.
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);
    await openTable();

    expect(screen.getByRole('rowheader', { name: 'B-2026-001' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'B-2026-002' })).toBeInTheDocument();
  });

  it('reports the counts behind each rate, not only the percentage', async () => {
    // "812 of 1 140 cells" is the form a process engineer reasons in, and it
    // cannot be recovered from a rounded percentage.
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);
    await openTable();

    expect(screen.getByText('770 of 1,200 cells')).toBeInTheDocument();
  });

  it('formats percentages for the reader’s locale', async () => {
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);
    await openTable();

    expect(screen.getByText('71.8%')).toBeInTheDocument();
  });

  it('renders entirely in German on the German locale', async () => {
    // The drawing is aria-hidden, so this caption is the chart's whole
    // announced identity. An English default here would ship silently: axe is
    // indifferent to which language a well-formed string is in, and so is every
    // screenshot.
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="de" />);

    expect(
      screen.getByRole('heading', { name: 'Erstdurchlaufquote je Charge' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));
    // Non-breaking space before the sign, and a comma decimal separator.
    expect(screen.getByText('71,8 %')).toBeInTheDocument();
  });

  it('keeps the batches in the order they were produced', async () => {
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);
    await openTable();

    const rows = within(screen.getByRole('table')).getAllByRole('rowheader');
    expect(rows.map((row) => row.textContent)).toEqual(['B-2026-001', 'B-2026-002']);
  });

  it('sorts the batches by yield, which payload order cannot answer', async () => {
    // The chart shows the shape of the series. "Which were the worst runs" is a
    // different question, and sixty batches arrive chronologically - the one
    // order that cannot answer it.
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);
    await openTable();

    const header = screen.getByRole('columnheader', { name: /First-pass yield/ });
    await userEvent.click(within(header).getByRole('button'));

    expect(header).toHaveAttribute('aria-sort', 'ascending');
    const rows = within(screen.getByRole('table')).getAllByRole('rowheader');
    expect(rows.map((row) => row.textContent)).toEqual(['B-2026-001', 'B-2026-002']);

    await userEvent.click(within(header).getByRole('button'));

    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['B-2026-002', 'B-2026-001']);
  });

  it('finds one batch by code without scrolling the whole window', async () => {
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);
    await openTable();

    await userEvent.type(screen.getByLabelText(/^Search/), 'B-2026-002');

    const rows = within(screen.getByRole('table')).getAllByRole('rowheader');
    expect(rows.map((row) => row.textContent)).toEqual(['B-2026-002']);
  });

  it('exports every column as the reader sees it, not as raw precision', async () => {
    /*
     * The export reads each column's `text`, which is the formatted value on
     * screen. This project has already had full NUMERIC precision reach a
     * payload once - 88.3248275862069 where the instrument measured 88.3 - and
     * an export is exactly where that would resurface, implying a precision
     * nobody has.
     */
    const csv = captureCsvDownload();
    render(<YieldTrendChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />);
    await openTable();

    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    const bytes = await csv.bytes();
    // UTF-8 BOM, or Excel reads the file as the system codepage.
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

    const text = await csv.text();
    expect(text).toContain('Batch,Started,First-pass yield,Cells');
    expect(text).toContain('B-2026-001');
    expect(text).toContain('64.2%');
    expect(text).not.toContain('64.19999');

    csv.restore();
  });

  it('renders an empty window without throwing', () => {
    // A configured line that has produced nothing is a real state, not an error.
    expect(() =>
      render(<YieldTrendChart points={[]} benchmark={benchmark} lineKind="pilot" locale="en" />),
    ).not.toThrow();
  });
});
