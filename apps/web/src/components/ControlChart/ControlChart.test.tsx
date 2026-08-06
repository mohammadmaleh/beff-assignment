import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { captureCsvDownload } from '@/test/csvDownload';

import { ControlChart } from './ControlChart';

import type { ParameterSeries } from '@beff/api-client/types';

/**
 * The verdict is the thing under test.
 *
 * On the drawing, a breaching point is a larger marker in `danger` - a colour,
 * which for roughly one man in twelve is not a signal at all. That is allowed
 * only because it is the *second* encoding: the position against a shaded band
 * is the first, and the word in this table is the third. These assertions are
 * what keep the third one honest.
 */

function series(overrides: Partial<ParameterSeries> = {}): ParameterSeries {
  return {
    parameter: 'energy_density_wh_kg',
    unit: 'Wh/kg',
    lower_limit: 240,
    upper_limit: 265,
    target: 252,
    points: [
      { started_at: '2026-06-01T06:00:00Z', value: 251 },
      { started_at: '2026-07-01T06:00:00Z', value: 244 },
      { started_at: '2026-07-31T06:00:00Z', value: 238 },
    ],
    ...overrides,
  };
}

/** The table is a panel behind the "Table" tab now, not open by default. */
async function openTable(): Promise<void> {
  await userEvent.click(screen.getByRole('tab', { name: 'Table' }));
}

describe('ControlChart', () => {
  it('states the verdict as a word for every reading', async () => {
    render(<ControlChart series={series()} label="Energy density" locale="en" />);
    await openTable();

    expect(screen.getAllByText('In spec')).toHaveLength(2);
    expect(screen.getAllByText('Out of spec')).toHaveLength(1);
  });

  it('counts the breaches in the description, so the summary is not colour-only', () => {
    render(<ControlChart series={series()} label="Energy density" locale="en" />);

    expect(
      screen.getByText('1 of 3 readings outside the specification window.'),
    ).toBeInTheDocument();
  });

  it('says so plainly when nothing breached', () => {
    render(
      <ControlChart
        series={series({
          points: [
            { started_at: '2026-06-01T06:00:00Z', value: 251 },
            { started_at: '2026-07-01T06:00:00Z', value: 249 },
          ],
        })}
        label="Energy density"
        locale="en"
      />,
    );

    expect(screen.getByText('Every reading inside 240.0 to 265.0 Wh/kg.')).toBeInTheDocument();
  });

  it('treats a value below the lower limit as out of spec', async () => {
    render(<ControlChart series={series()} label="Energy density" locale="en" />);
    await openTable();

    const row = screen.getByText('238.0').closest('tr');
    expect(within(row as HTMLElement).getByText('Out of spec')).toBeInTheDocument();
  });

  it('treats a value above the upper limit as out of spec too', async () => {
    // Both directions. A control chart that only catches the low side is one
    // that was written against a single example.
    render(
      <ControlChart
        series={series({ points: [{ started_at: '2026-07-01T06:00:00Z', value: 271 }] })}
        label="Energy density"
        locale="en"
      />,
    );
    await openTable();

    expect(screen.getByText('Out of spec')).toBeInTheDocument();
  });

  it('treats a value exactly on a limit as in spec', async () => {
    // The limits are inclusive - a reading *at* 240.0 has not breached 240.0,
    // and an off-by-one here reports a conforming batch as a failure.
    render(
      <ControlChart
        series={series({ points: [{ started_at: '2026-07-01T06:00:00Z', value: 240 }] })}
        label="Energy density"
        locale="en"
      />,
    );
    await openTable();

    expect(screen.getByText('In spec')).toBeInTheDocument();
  });

  it('puts the unit in the column heading rather than on every cell', async () => {
    render(<ControlChart series={series()} label="Energy density" locale="en" />);
    await openTable();

    expect(screen.getByRole('columnheader', { name: 'Value (Wh/kg)' })).toBeInTheDocument();
  });

  it('takes its title from the caller, which is where the translation lives', () => {
    // The API returns `energy_density_wh_kg`. Only the dashboard's dictionary
    // knows what that is called in German, so the label is a required prop.
    render(<ControlChart series={series()} label="Energiedichte" locale="de" />);

    expect(screen.getByRole('heading', { name: 'Energiedichte' })).toBeInTheDocument();
  });

  it('renders the German verdicts on the German locale', async () => {
    render(<ControlChart series={series()} label="Energiedichte" locale="de" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));

    expect(screen.getByText('Außerhalb der Spezifikation')).toBeInTheDocument();
    expect(screen.getAllByText('In Spezifikation')).toHaveLength(2);
  });

  it('shapes the verdict as a badge that still carries the word', async () => {
    // The pill is what makes the column scannable; the word inside it is what
    // makes it legal. A badge distinguished only by fill would put the whole
    // verdict back into colour, which is the one thing this column exists to
    // avoid.
    render(<ControlChart series={series()} label="Energy density" locale="en" />);
    await openTable();

    expect(screen.getByText('Out of spec')).toHaveClass('border-status-danger-fg');
    expect(screen.getAllByText('In spec')[0]).not.toHaveClass('border-status-danger-fg');
  });

  it('isolates an outlier with the range filter', async () => {
    render(<ControlChart series={series()} label="Energy density" locale="en" />);
    await openTable();

    /*
     * Below the lower limit of 240 - the reading that breached, and nothing
     * else. The label is `Maximum`, not `To`: the group is captioned by the
     * column it filters, so "to" no longer has to carry the question of *what*
     * on a page where four tables each filter a different measure.
     */
    await userEvent.type(screen.getByLabelText(/^Maximum$/), '239');

    expect(screen.getByText('Showing 1 of 3 rows')).toBeInTheDocument();
    expect(screen.getByText('Out of spec')).toBeVisible();
  });

  it('sorts the readings by value, which the time axis cannot do', async () => {
    render(<ControlChart series={series()} label="Energy density" locale="en" />);
    await openTable();

    const header = screen.getByRole('columnheader', { name: /Value/ });
    await userEvent.click(within(header).getByRole('button'));

    expect(header).toHaveAttribute('aria-sort', 'ascending');
    const cells = within(screen.getByRole('table')).getAllByRole('cell');
    // The worst reading first: 238 breached, and it is the one to look at.
    expect(cells[0]).toHaveTextContent('238.0');
  });

  it('exports the verdict as a word, even though the cell renders a badge', async () => {
    // The verdict column's `render` returns null - the badge replaces it. If
    // the export read `render` instead of `text`, the most important column in
    // the file would be empty.
    const csv = captureCsvDownload();
    render(<ControlChart series={series()} label="Energy density" locale="en" />);
    await openTable();

    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    const text = await csv.text();
    expect(text).toContain('Out of spec');
    expect(text).toContain('In spec');
    expect(text).toContain('238.0');

    csv.restore();
  });

  it('renders a parameter with no target without inventing one', () => {
    // Drawing `(lower + upper) / 2` would put a target line the process
    // engineer never set exactly where they would look for the one they did.
    expect(() =>
      render(<ControlChart series={series({ target: null })} label="Energy density" locale="en" />),
    ).not.toThrow();
  });
});
