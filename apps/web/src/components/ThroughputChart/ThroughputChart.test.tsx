import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { captureCsvDownload } from '@/test/csvDownload';

import { ThroughputChart } from './ThroughputChart';

import type { TrendPoint } from '@beff/api-client/types';

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

/** The table is a panel behind the "Table" tab now, not open by default. */
async function openTable(): Promise<void> {
  await userEvent.click(screen.getByRole('tab', { name: 'Table' }));
}

describe('ThroughputChart', () => {
  it('reports counts, which is what distinguishes it from the yield chart', async () => {
    // A 42% yield on a 180-cell trial and on a 1 400-cell run are the same
    // point on the yield chart and very different events. This is the chart
    // that makes batch size visible.
    render(
      <ThroughputChart
        points={[
          point({
            batch_code: 'B-small',
            cells_started: 180,
            cells_passed: 76,
            cells_scrapped: 104,
          }),
          point({
            batch_code: 'B-large',
            cells_started: 1400,
            cells_passed: 588,
            cells_scrapped: 812,
          }),
        ]}
        locale="en"
      />,
    );
    await openTable();

    const small = screen.getByRole('rowheader', { name: 'B-small' }).closest('tr');
    expect(within(small as HTMLElement).getByText('180')).toBeInTheDocument();

    const large = screen.getByRole('rowheader', { name: 'B-large' }).closest('tr');
    expect(within(large as HTMLElement).getByText('1,400')).toBeInTheDocument();
  });

  it('breaks each run into what passed and what was scrapped', async () => {
    render(<ThroughputChart points={[point()]} locale="en" />);
    await openTable();

    const row = screen.getByRole('rowheader', { name: 'B-2026-001' }).closest('tr');
    expect(within(row as HTMLElement).getByText('816')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('384')).toBeInTheDocument();
  });

  it('names both series in the table header, so identity is never colour-alone', async () => {
    // The drawing carries a legend for the same reason. In the table the column
    // heading is the legend, and it works in greyscale and on paper.
    render(<ThroughputChart points={[point()]} locale="en" />);
    await openTable();

    expect(screen.getByRole('columnheader', { name: 'Passed end-of-line' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Scrapped' })).toBeInTheDocument();
  });

  it('renders in German on the German locale', async () => {
    render(<ThroughputChart points={[point()]} locale="de" />);

    expect(
      screen.getByRole('heading', { name: 'Was jeder Lauf produziert hat' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));
    expect(screen.getByRole('columnheader', { name: 'Endprüfung bestanden' })).toBeInTheDocument();
  });

  it('groups thousands in the reader’s locale', async () => {
    render(<ThroughputChart points={[point({ cells_started: 1200 })]} locale="de" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));

    // Scoped to the table: the y-axis now renders its own ticks as real `<text>`
    // in the SVG, so the same figure legitimately appears twice on the page.
    expect(within(screen.getByRole('table')).getByText('1.200')).toBeInTheDocument();
  });

  it('sorts by cells started, so the big runs can be found among the trials', async () => {
    // A 180-cell trial and a 1 400-cell run are the same point on the yield
    // chart and very different events. Sorting is how the reader separates them
    // without reading sixty rows.
    render(
      <ThroughputChart
        points={[
          point({ batch_code: 'B-2026-001', cells_started: 1400 }),
          point({ batch_code: 'B-2026-002', cells_started: 180 }),
        ]}
        locale="en"
      />,
    );
    await openTable();

    const header = screen.getByRole('columnheader', { name: /Cells started/ });
    await userEvent.click(within(header).getByRole('button'));

    expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['B-2026-002', 'B-2026-001']);
  });

  it('finds one batch by code', async () => {
    render(
      <ThroughputChart
        points={[point({ batch_code: 'B-2026-001' }), point({ batch_code: 'B-2026-002' })]}
        locale="en"
      />,
    );
    await openTable();

    await userEvent.type(screen.getByLabelText(/^Search/), 'B-2026-002');

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['B-2026-002']);
  });

  it('exports the counts as the reader sees them', async () => {
    const csv = captureCsvDownload();
    render(<ThroughputChart points={[point({ batch_code: 'B-2026-001' })]} locale="en" />);
    await openTable();

    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    const text = await csv.text();
    expect(text).toContain('B-2026-001');
    // 1200 grouped as '1,200' in English, and the comma is the delimiter — so
    // the cell has to arrive quoted or every column after it shifts by one.
    expect(text).toContain('"1,200"');

    csv.restore();
  });

  it('renders an empty window without throwing', () => {
    expect(() => render(<ThroughputChart points={[]} locale="en" />)).not.toThrow();
  });
});
