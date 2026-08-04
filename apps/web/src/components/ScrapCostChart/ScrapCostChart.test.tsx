import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { captureCsvDownload } from '@/test/csvDownload';

import { ScrapCostChart } from './ScrapCostChart';

import type { ScrapByStep } from '@beff/api-client/types';

/**
 * The one property this chart must never lose is its ordering. Everything else
 * here is formatting; the order is the argument.
 */

const rows: ScrapByStep[] = [
  // Deliberately shuffled, and deliberately shaped like the real data: coating
  // scraps the most cells, formation loses the most money.
  { process_step: 'formation', scrap_rate_pct: 5.4, committed_value_eur: 12800 },
  { process_step: 'mixing', scrap_rate_pct: 1.1, committed_value_eur: 210 },
  { process_step: 'coating', scrap_rate_pct: 7.8, committed_value_eur: 4100 },
];

/** The table is a panel behind the "Table" tab now, not open by default. */
async function openTable(): Promise<void> {
  await userEvent.click(screen.getByRole('tab', { name: 'Table' }));
}

function stepNames(): string[] {
  return within(screen.getByRole('table'))
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent ?? '');
}

describe('ScrapCostChart', () => {
  it('orders the steps by position in the line, never by size', async () => {
    // A Pareto sort would read more "correctly" as a chart and would destroy
    // the meaning: the horizontal position of a bar *is* the cell's progress
    // through the line, which is why committed value rises across it.
    render(<ScrapCostChart rows={rows} locale="en" />);
    await openTable();

    expect(stepNames()).toEqual(['Mixing', 'Coating', 'Formation']);
  });

  it('does not reorder when the largest loss is not the last step', async () => {
    render(
      <ScrapCostChart
        rows={[
          { process_step: 'eol_test', scrap_rate_pct: 0.4, committed_value_eur: 90 },
          { process_step: 'coating', scrap_rate_pct: 7.8, committed_value_eur: 41000 },
        ]}
        locale="en"
      />,
    );
    await openTable();

    expect(stepNames()).toEqual(['Coating', 'End-of-line test']);
  });

  it('reports the money as money, without cents', async () => {
    // Scoped to the table on purpose. The SVG renderer emits the bar's direct
    // label as real `<text>`, so an unscoped `getByText` finds the same figure
    // twice — which is itself worth knowing: the drawing is aria-hidden, so
    // role queries skip it while text queries do not.
    render(<ScrapCostChart rows={rows} locale="en" />);
    await openTable();

    expect(within(screen.getByRole('table')).getByText('€12,800')).toBeInTheDocument();
  });

  it('carries the scrap rate alongside the cost, so the two can be compared', async () => {
    // The whole point of this chart sitting beside `ScrapChart`: coating leads
    // on rate, formation leads on cost. A reader must be able to see both
    // numbers for one step without switching tables.
    render(<ScrapCostChart rows={rows} locale="en" />);
    await openTable();

    const coating = screen.getByRole('rowheader', { name: 'Coating' }).closest('tr');
    expect(coating).not.toBeNull();
    expect(within(coating as HTMLElement).getByText('7.8%')).toBeInTheDocument();
    expect(within(coating as HTMLElement).getByText('€4,100')).toBeInTheDocument();
  });

  it('names the process steps in German on the German locale', async () => {
    // The API returns a stable key (`die_cutting`), never a display string —
    // which is the only reason the German locale can name it in German.
    render(<ScrapCostChart rows={rows} locale="de" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));

    expect(stepNames()).toEqual(['Mischen', 'Beschichten', 'Formierung']);
  });

  it('puts the euro sign where German puts it', async () => {
    render(<ScrapCostChart rows={rows} locale="de" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));

    expect(within(screen.getByRole('table')).getByText(/12\.800\s€/)).toBeInTheDocument();
  });

  it('offers sorting by cost without imposing it', async () => {
    /*
     * Process order is the argument this chart makes: a cell lost at formation
     * has absorbed every upstream cost, so a bar's position carries economic
     * meaning that re-sorting destroys. Sorting is therefore the reader's
     * choice and never the default — the first assertion is the important one.
     */
    render(<ScrapCostChart rows={rows} locale="en" />);
    await openTable();

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['Mixing', 'Coating', 'Formation']);

    const header = screen.getByRole('columnheader', { name: /Committed value lost/ });
    await userEvent.click(within(header).getByRole('button'));
    await userEvent.click(within(header).getByRole('button'));

    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
      // Formation first: the most expensive step, which is the whole point the
      // chart exists to make against the rate breakdown beside it.
    ).toEqual(['Formation', 'Coating', 'Mixing']);
  });

  it('exports with the delimiter the reader’s Excel expects', async () => {
    /*
     * German Excel splits on semicolons. A comma-delimited file opens there as
     * one column per row, which reads to the user as a broken export rather
     * than as a locale mismatch — and German formats the euro amount with a
     * comma inside it, so the two collide in exactly the wrong way.
     */
    const csv = captureCsvDownload();
    render(<ScrapCostChart rows={rows} locale="de" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));

    await userEvent.click(screen.getByRole('button', { name: 'CSV herunterladen' }));

    const text = await csv.text();
    expect(text).toContain('Prozessschritt;Ausschussquote;Verlorene gebundene Wertschöpfung');
    expect(text).not.toContain('Prozessschritt,');

    csv.restore();
  });

  it('falls back to the raw key for a step the frontend has not been taught', async () => {
    // A step added to the backend must appear as an unfamiliar name, not vanish
    // from a chart that claims to break down all of the scrap.
    render(
      <ScrapCostChart
        rows={[{ process_step: 'laser_notching', scrap_rate_pct: 1, committed_value_eur: 10 }]}
        locale="en"
      />,
    );
    await openTable();

    expect(screen.getByRole('rowheader', { name: 'laser_notching' })).toBeInTheDocument();
  });
});
