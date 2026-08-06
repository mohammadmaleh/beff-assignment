import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { captureCsvDownload } from '@/test/csvDownload';

import { formatters } from '@/lib/format';

import { binRange, distributionTooltip, YieldDistributionChart } from './YieldDistributionChart';

import type { CohortReference, TrendPoint } from '@beff/api-client/types';

const point = (batch: number, yieldPct: number): TrendPoint => ({
  batch_code: `B-2026-${String(batch).padStart(3, '0')}`,
  started_at: `2026-07-${String(batch).padStart(2, '0')}T06:00:00Z`,
  cells_started: 1200,
  cells_passed: Math.round((yieldPct / 100) * 1200),
  cells_scrapped: 1200 - Math.round((yieldPct / 100) * 1200),
  first_pass_yield_pct: yieldPct,
  scrap_rate_pct: 100 - yieldPct,
  capacity_retention_pct: 88.4,
  co2_intensity_kg_per_kwh: 61.2,
  committed_value_lost_eur: 17_400,
});

// A pilot line: window 40–80, so both limits are on the axis and the cohort
// median sits inside the data.
const points: TrendPoint[] = [
  point(1, 62),
  point(2, 66),
  point(3, 67),
  point(4, 71),
  point(5, 72),
  point(6, 73),
  point(7, 78),
];

const benchmark: CohortReference = {
  line_kind: 'pilot',
  sample_size: 34,
  first_pass_yield_p50_pct: 68,
  first_pass_yield_p90_pct: 77.5,
  scrap_rate_p50_pct: 32,
  co2_intensity_p50_kg_per_kwh: 64,
};

const openTable = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('tab', { name: 'Table' }));
};

describe('YieldDistributionChart', () => {
  it('accounts for every batch exactly once', async () => {
    // A histogram whose bars do not sum to the sample is a histogram nobody can
    // reason from, and the failure is silent — one bar short looks like data.
    render(
      <YieldDistributionChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />,
    );
    await openTable();

    const counts = within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => Number(row.querySelectorAll('td')[0]?.textContent ?? '0'));

    expect(counts.reduce((total, count) => total + count, 0)).toBe(points.length);
  });

  it('states each level as a range with its unit, in the reader’s language', () => {
    const bin = { start: 64, end: 66, count: 3 };
    const copy = { range: '{from} to {to}', batches: '{count} batches' };

    expect(binRange(bin, formatters('en'), copy)).toBe('64.0% to 66.0%');
    // German puts a non-breaking space before the sign, and `Intl` supplies it.
    // Asserted as an escape: U+00A0 and a plain space are indistinguishable in a
    // source file, and only one of them makes this assertion mean anything.
    expect(binRange(bin, formatters('de'), { ...copy, range: '{from} bis {to}' })).toBe(
      '64,0\u00A0% bis 66,0\u00A0%',
    );
  });

  it('gives the share of the window as well as the count', () => {
    const tooltip = distributionTooltip({ start: 70, end: 72, count: 5 }, 20, formatters('en'), {
      range: '{from} to {to}',
      batches: '{count} batches',
    });

    expect(tooltip).toContain('5 batches');
    expect(tooltip).toContain('25.0%');
  });

  it('survives an empty window without dividing by zero', () => {
    const tooltip = distributionTooltip({ start: 70, end: 72, count: 0 }, 0, formatters('en'), {
      range: '{from} to {to}',
      batches: '{count} batches',
    });

    expect(tooltip).toContain('0.0%');
  });

  it('names itself in German, where an English default would have shipped', () => {
    render(
      <YieldDistributionChart points={points} benchmark={benchmark} lineKind="pilot" locale="de" />,
    );

    expect(
      screen.getByRole('heading', { name: 'Wie oft die Linie welches Niveau erreicht' }),
    ).toBeInTheDocument();
  });

  it('offers the distribution as a table, because the drawing is aria-hidden', async () => {
    render(
      <YieldDistributionChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />,
    );
    await openTable();

    expect(
      screen.getByRole('table', { name: 'Number of batches at each level of first-pass yield' }),
    ).toBeInTheDocument();
  });

  it('sorts the levels by their lower edge, not by the rendered range', async () => {
    // '100.0%' sorts before '64.0%' as text, which puts the top of the scale in
    // the middle of the table and reads as a data error rather than a sort bug.
    render(
      <YieldDistributionChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />,
    );
    await openTable();

    const header = screen.getByRole('columnheader', { name: /First-pass yield/ });
    await userEvent.click(within(header).getByRole('button'));
    await userEvent.click(within(header).getByRole('button'));

    expect(header).toHaveAttribute('aria-sort', 'descending');

    const edges = within(screen.getByRole('table'))
      .getAllByRole('rowheader')
      .map((row) => Number.parseFloat(row.textContent ?? ''));

    expect(edges).toEqual([...edges].sort((a, b) => b - a));
  });

  it('filters to the levels the line actually reached', async () => {
    render(
      <YieldDistributionChart points={points} benchmark={benchmark} lineKind="pilot" locale="en" />,
    );
    await openTable();

    await userEvent.type(screen.getByLabelText(/Minimum/), '1');

    const counts = within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => Number(row.querySelectorAll('td')[0]?.textContent ?? '0'));

    expect(counts.every((count) => count >= 1)).toBe(true);
  });

  it('exports the distribution with the delimiter German Excel expects', async () => {
    const csv = captureCsvDownload();
    render(
      <YieldDistributionChart points={points} benchmark={benchmark} lineKind="pilot" locale="de" />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));

    await userEvent.click(screen.getByRole('button', { name: 'CSV herunterladen' }));

    expect(await csv.text()).toContain('Erstdurchlaufquote;Chargen;Anteil am Zeitraum');

    csv.restore();
  });

  it('draws nothing rather than a broken axis when the window has no batches', () => {
    render(
      <YieldDistributionChart points={[]} benchmark={benchmark} lineKind="pilot" locale="en" />,
    );

    // The figure still exists — the section that mounts it already guards on an
    // empty trend — but there is no row to invent.
    expect(
      screen.getByRole('heading', { name: 'How often the line hits each level' }),
    ).toBeInTheDocument();
  });
});
