import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

function stepNames(): string[] {
  return within(screen.getByRole('table'))
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent ?? '');
}

describe('ScrapCostChart', () => {
  it('orders the steps by position in the line, never by size', () => {
    // A Pareto sort would read more "correctly" as a chart and would destroy
    // the meaning: the horizontal position of a bar *is* the cell's progress
    // through the line, which is why committed value rises across it.
    render(<ScrapCostChart rows={rows} locale="en" />);

    expect(stepNames()).toEqual(['Mixing', 'Coating', 'Formation']);
  });

  it('does not reorder when the largest loss is not the last step', () => {
    render(
      <ScrapCostChart
        rows={[
          { process_step: 'eol_test', scrap_rate_pct: 0.4, committed_value_eur: 90 },
          { process_step: 'coating', scrap_rate_pct: 7.8, committed_value_eur: 41000 },
        ]}
        locale="en"
      />,
    );

    expect(stepNames()).toEqual(['Coating', 'End-of-line test']);
  });

  it('reports the money as money, without cents', () => {
    // Scoped to the table on purpose. The SVG renderer emits the bar's direct
    // label as real `<text>`, so an unscoped `getByText` finds the same figure
    // twice — which is itself worth knowing: the drawing is aria-hidden, so
    // role queries skip it while text queries do not.
    render(<ScrapCostChart rows={rows} locale="en" />);

    expect(within(screen.getByRole('table')).getByText('€12,800')).toBeInTheDocument();
  });

  it('carries the scrap rate alongside the cost, so the two can be compared', () => {
    // The whole point of this chart sitting beside `ScrapChart`: coating leads
    // on rate, formation leads on cost. A reader must be able to see both
    // numbers for one step without switching tables.
    render(<ScrapCostChart rows={rows} locale="en" />);

    const coating = screen.getByRole('rowheader', { name: 'Coating' }).closest('tr');
    expect(coating).not.toBeNull();
    expect(within(coating as HTMLElement).getByText('7.8%')).toBeInTheDocument();
    expect(within(coating as HTMLElement).getByText('€4,100')).toBeInTheDocument();
  });

  it('names the process steps in German on the German locale', () => {
    // The API returns a stable key (`die_cutting`), never a display string —
    // which is the only reason the German locale can name it in German.
    render(<ScrapCostChart rows={rows} locale="de" />);

    expect(stepNames()).toEqual(['Mischen', 'Beschichten', 'Formierung']);
  });

  it('puts the euro sign where German puts it', () => {
    render(<ScrapCostChart rows={rows} locale="de" />);

    expect(within(screen.getByRole('table')).getByText(/12\.800\s€/)).toBeInTheDocument();
  });

  it('falls back to the raw key for a step the frontend has not been taught', () => {
    // A step added to the backend must appear as an unfamiliar name, not vanish
    // from a chart that claims to break down all of the scrap.
    render(
      <ScrapCostChart
        rows={[{ process_step: 'laser_notching', scrap_rate_pct: 1, committed_value_eur: 10 }]}
        locale="en"
      />,
    );

    expect(screen.getByRole('rowheader', { name: 'laser_notching' })).toBeInTheDocument();
  });
});
