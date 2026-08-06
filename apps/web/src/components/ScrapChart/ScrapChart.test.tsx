import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { formatters } from '@/lib/format';

import { ScrapChart, scrapTooltip } from './ScrapChart';

/**
 * `ScrapChart` set the inversion the whole chart layer is built on - the bars
 * are `aria-hidden` and the table is the authoritative rendering - and was then
 * the one chart never moved onto `ChartFigure`. It carried its own `<details>`,
 * its own table markup and its own number formatting, and it had no test file
 * at all. These are its first.
 */

const rows = [
  // Deliberately shuffled. Coating scraps the most cells; formation loses the
  // most money, which is the disagreement the cost chart beside it exists for.
  { process_step: 'formation', scrap_rate_pct: 2.4, committed_value_eur: 48_000 },
  { process_step: 'coating', scrap_rate_pct: 7.8, committed_value_eur: 4100 },
];

const order = ['coating', 'formation'];

function renderChart(locale: 'en' | 'de' = 'en') {
  return render(<ScrapChart rows={rows} locale={locale} order={order} />);
}

/** The table is a panel behind the "Table" tab, not open by default. */
async function openTable(): Promise<void> {
  await userEvent.click(screen.getByRole('tab', { name: 'Table' }));
}

describe('ScrapChart', () => {
  it('is a figure, like every other chart in the layer', () => {
    renderChart();

    expect(screen.getByRole('figure')).toBeInTheDocument();
  });

  it('does not repeat the section heading as the figure heading', () => {
    // `DashboardView` renders "Where the scrap happened" as the section's h2
    // directly above this. The same words as the figure's h3 would be announced
    // twice in a row.
    renderChart();

    expect(screen.getByRole('heading', { name: 'Scrap rate by step' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Where the scrap happened' })).toBeNull();
  });

  it('hides the bars from assistive technology', () => {
    // The bars are decoration over the table, not content. Left exposed, an
    // ECharts SVG is dozens of loose `<text>` nodes - axis ticks, bar labels -
    // read in visual order with no structure: "7.8% 2.4% Coating Formation".
    const { container } = renderChart();

    const drawing = container.querySelector('[aria-hidden="true"][style*="block-size"]');
    expect(drawing).not.toBeNull();
  });

  it('offers the table as a named view rather than a disclosure', async () => {
    renderChart();
    await openTable();

    expect(screen.getByRole('table', { name: 'Scrap rate by process step' })).toBeInTheDocument();
  });

  it('keeps process order by default, because position carries economic meaning', async () => {
    // A cell lost at formation has absorbed every upstream cost. Sorting by
    // size by default would destroy that, so it is offered and never imposed.
    renderChart();
    await openTable();

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['Coating', 'Formation']);
  });

  it('sorts by committed value when the reader asks for it', async () => {
    renderChart();
    await openTable();

    const header = screen.getByRole('columnheader', { name: /Committed value lost/ });
    await userEvent.click(within(header).getByRole('button'));

    expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['Coating', 'Formation']);
  });

  it('puts the non-breaking space before the per-cent sign in German', async () => {
    /*
     * The regression this file was written for. The component built its
     * percentages by concatenating `'%'` onto a formatted number, which renders
     * `7,8%` in German - where the space before the sign is mandatory and
     * non-breaking. Formatting rather than concatenating is the fix, and the
     * assertion has to contain a literal U+00A0 to prove it.
     */
    renderChart('de');
    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));

    expect(within(screen.getByRole('table')).getByText('7,8 %')).toBeInTheDocument();
  });

  it('renders the same figure in the bars as in the table', async () => {
    /*
     * One formatter for both. Two would be two chances for the drawing and the
     * authoritative rendering to disagree about the same number - which is not
     * hypothetical here: this component shipped `7,8%` in German from its own
     * `Intl.NumberFormat` while the table beside it read `7,8 %`.
     *
     * The bar's direct label is real `<text>` under the SVG renderer, so it can
     * be read back. Scoped to the drawing, because after `openTable` the same
     * string is legitimately on screen twice.
     */
    const { container } = renderChart();

    const drawing = container.querySelector('[aria-hidden="true"][style*="block-size"]');
    expect(drawing?.textContent).toContain('7.8%');

    await openTable();
    expect(within(screen.getByRole('table')).getByText('7.8%')).toBeInTheDocument();
  });

  it('searches across the step name, the rate and the money', async () => {
    // Search reads every column's `text`, which is the formatted value the
    // reader sees. A column whose text() disagreed with its render() would let
    // a search miss a row that is visibly on screen.
    renderChart();
    await openTable();

    await userEvent.type(screen.getByLabelText(/^Search/), 'Formation');

    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['Formation']);
    expect(screen.getByText('Showing 1 of 2 rows')).toBeInTheDocument();
  });

  it('sorts by step name alphabetically when asked', async () => {
    renderChart();
    await openTable();

    const header = screen.getByRole('columnheader', { name: /Process step/ });
    await userEvent.click(within(header).getByRole('button'));
    await userEvent.click(within(header).getByRole('button'));

    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((row) => row.textContent),
    ).toEqual(['Formation', 'Coating']);
  });

  it('falls back to the raw key for a step the frontend has not been taught', async () => {
    render(
      <ScrapChart
        rows={[{ process_step: 'laser_notching', scrap_rate_pct: 1, committed_value_eur: 10 }]}
        locale="en"
        order={['laser_notching']}
      />,
    );
    await openTable();

    expect(screen.getByRole('rowheader', { name: 'laser_notching' })).toBeInTheDocument();
  });

  it('renders an empty breakdown without throwing', () => {
    expect(() => render(<ScrapChart rows={[]} locale="en" order={order} />)).not.toThrow();
  });
});

describe('scrapTooltip', () => {
  /*
   * A formatter handed to ECharts only ever runs on hover, which means it never
   * runs under test - mounting the chart proves nothing about it, and in jsdom
   * the instance lays out at 0×0 so there is no hover to simulate either. That
   * is why the content is a pure function and this is a unit: otherwise the one
   * string in this component assembled by hand is also the only one with no
   * coverage at all.
   */
  const steps = { coating: 'Coating' };
  const copy = { columnScrap: 'Scrap rate', columnCost: 'Committed value lost' };

  it('carries the rate and the money together, so the two can be compared', () => {
    // The whole point of the pairing: this chart plots the rate and the one
    // below it plots the cost, and coating leads on one while formation leads
    // on the other. A reader must get both figures for a step from one hover.
    const html = scrapTooltip(
      { process_step: 'coating', scrap_rate_pct: 7.8, committed_value_eur: 4100 },
      steps,
      formatters('en'),
      copy,
    );

    expect(html).toContain('<strong>Coating</strong>');
    expect(html).toContain('Scrap rate: 7.8%');
    expect(html).toContain('Committed value lost: €4,100');
  });

  it('formats for the reader’s locale, not the chart’s', () => {
    // The regression this component already shipped once, in the place it is
    // hardest to see: German needs a non-breaking space before the per-cent
    // sign, and a tooltip is never in a screenshot.
    const html = scrapTooltip(
      { process_step: 'coating', scrap_rate_pct: 7.8, committed_value_eur: 4100 },
      { coating: 'Beschichten' },
      formatters('de'),
      { columnScrap: 'Ausschussquote', columnCost: 'Verlorene Wertschöpfung' },
    );

    expect(html).toContain('Ausschussquote: 7,8 %');
    expect(html).toContain('4.100 €');
  });

  it('names a step the frontend has not been taught rather than dropping it', () => {
    const html = scrapTooltip(
      { process_step: 'laser_notching', scrap_rate_pct: 1, committed_value_eur: 10 },
      steps,
      formatters('en'),
      copy,
    );

    expect(html).toContain('<strong>laser_notching</strong>');
  });
});
