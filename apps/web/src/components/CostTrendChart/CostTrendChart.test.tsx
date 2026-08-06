import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { captureCsvDownload } from '@/test/csvDownload';

import { formatters } from '@/lib/format';

import { costTrendTooltip, CostTrendChart, cumulative } from './CostTrendChart';

import type { TrendPoint } from '@beff/api-client/types';

const point = (batch: number, lost: number): TrendPoint => ({
  batch_code: `B-2026-${String(batch).padStart(3, '0')}`,
  started_at: `2026-07-${String(batch).padStart(2, '0')}T06:00:00Z`,
  cells_started: 1200,
  cells_passed: 900,
  cells_scrapped: 300,
  first_pass_yield_pct: 75,
  scrap_rate_pct: 25,
  capacity_retention_pct: 88.4,
  co2_intensity_kg_per_kwh: 61.2,
  committed_value_lost_eur: lost,
});

const points: TrendPoint[] = [point(1, 10_000), point(2, 4_000), point(3, 6_500)];

const openTable = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('tab', { name: 'Table' }));
};

describe('cumulative', () => {
  it('starts at the first batch, not at zero, and never resets', () => {
    expect(cumulative(points).map((entry) => entry.cumulativeEur)).toEqual([
      10_000, 14_000, 20_500,
    ]);
  });

  it('keeps the batches in the order it was given them', () => {
    // The running total is only meaningful in time order. Sorting the input -
    // by size, say - would produce a curve that is arithmetically correct and
    // describes a month that never happened.
    expect(cumulative(points).map((entry) => entry.point.batch_code)).toEqual([
      'B-2026-001',
      'B-2026-002',
      'B-2026-003',
    ]);
  });

  it('is empty for an empty window', () => {
    expect(cumulative([])).toEqual([]);
  });
});

describe('costTrendTooltip', () => {
  it('carries the batch’s own loss as well as the running total', () => {
    // Without the per-batch figure the reader cannot tell a steep segment from
    // a long one, and the slope is the entire point of the chart.
    const entry = { point: point(2, 4_000), cumulativeEur: 14_000 };
    const tooltip = costTrendTooltip(entry, formatters('en'), {
      seriesName: 'Cumulative value lost',
      batchLoss: 'This batch',
    });

    expect(tooltip).toContain('B-2026-002');
    expect(tooltip).toContain('This batch: €4,000');
    expect(tooltip).toContain('Cumulative value lost: €14,000');
  });
});

describe('CostTrendChart', () => {
  it('ends the running total on the window’s total', async () => {
    render(<CostTrendChart points={points} locale="en" />);
    await openTable();

    const last = screen.getByRole('rowheader', { name: 'B-2026-003' }).closest('tr');
    expect(last).not.toBeNull();
    expect(within(last as HTMLElement).getByText('€20,500')).toBeInTheDocument();
  });

  it('reports euros without cents, as every money figure in this app does', async () => {
    render(<CostTrendChart points={points} locale="en" />);
    await openTable();

    // The first batch's own loss and the running total are necessarily the same
    // figure, and the row therefore carries it twice - which is the arithmetic
    // being right, not a duplicate. `getAllByText` on purpose.
    const first = screen.getByRole('rowheader', { name: 'B-2026-001' }).closest('tr');
    expect(within(first as HTMLElement).getAllByText('€10,000')).toHaveLength(2);
  });

  it('names itself in German, where an English default would have shipped', () => {
    render(<CostTrendChart points={points} locale="de" />);

    expect(
      screen.getByRole('heading', { name: 'Was der Zeitraum gekostet hat, im Verlauf' }),
    ).toBeInTheDocument();
  });

  it('offers the curve as a table, because the drawing is aria-hidden', async () => {
    render(<CostTrendChart points={points} locale="en" />);
    await openTable();

    expect(
      screen.getByRole('table', { name: 'Committed value lost per batch and cumulatively' }),
    ).toBeInTheDocument();
  });

  it('sorts by the number, never by the formatted euro string', async () => {
    // '€4,000' sorts before '€10,000' as text, which puts the cheapest batch in
    // the middle of a descending sort and looks like a data error.
    render(<CostTrendChart points={points} locale="en" />);
    await openTable();

    const header = screen.getByRole('columnheader', { name: /Lost in this batch/ });
    await userEvent.click(within(header).getByRole('button'));
    await userEvent.click(within(header).getByRole('button'));

    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['B-2026-001', 'B-2026-003', 'B-2026-002']);
  });

  it('filters the per-batch loss by range, and the running total follows the rows', async () => {
    render(<CostTrendChart points={points} locale="en" />);
    await openTable();

    await userEvent.type(screen.getByLabelText(/Minimum/), '6000');

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['B-2026-001', 'B-2026-003']);
  });

  it('filters by date on the instant, not on the rendered date', async () => {
    // 'Jul 1' sorts and compares as a string before 'Jun 2', and the German
    // rendering compares differently again.
    render(<CostTrendChart points={points} locale="en" />);
    await openTable();

    await userEvent.type(screen.getByLabelText(/Earliest/), '2026-07-02');

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['B-2026-002', 'B-2026-003']);
  });

  it('lets the reader sort by batch, by date and by the running total', async () => {
    /*
     * Every column is sortable, including the running total - which only ever
     * ascends in batch order, so sorting it is close to meaningless. It stays
     * sortable anyway: a column that refuses to sort looks broken, and a
     * `sortValue` that has never run is a comparator nobody has checked.
     */
    render(<CostTrendChart points={points} locale="en" />);
    await openTable();

    for (const name of [/^Batch/, /Started/, /Running total/]) {
      const header = screen.getByRole('columnheader', { name });
      await userEvent.click(within(header).getByRole('button'));
      expect(header).toHaveAttribute('aria-sort', 'ascending');
    }

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['B-2026-001', 'B-2026-002', 'B-2026-003']);
  });

  it('exports the running total with the delimiter German Excel expects', async () => {
    const csv = captureCsvDownload();
    render(<CostTrendChart points={points} locale="de" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));

    await userEvent.click(screen.getByRole('button', { name: 'CSV herunterladen' }));

    const text = await csv.text();
    expect(text).toContain('Charge;Gestartet;Verlust dieser Charge;Laufende Summe');

    csv.restore();
  });

  it('renders an empty window without a broken axis', () => {
    render(<CostTrendChart points={[]} locale="en" />);

    expect(
      screen.getByRole('heading', { name: 'What the window has cost, as it accumulated' }),
    ).toBeInTheDocument();
  });
});
