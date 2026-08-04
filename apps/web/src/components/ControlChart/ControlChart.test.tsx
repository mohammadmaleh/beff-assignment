import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ControlChart } from './ControlChart';

import type { ParameterSeries } from '@beff/api-client/types';

/**
 * The verdict is the thing under test.
 *
 * On the drawing, a breaching point is a larger marker in `danger` — a colour,
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

describe('ControlChart', () => {
  it('states the verdict as a word for every reading', () => {
    render(<ControlChart series={series()} label="Energy density" locale="en" />);

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

  it('treats a value below the lower limit as out of spec', () => {
    render(<ControlChart series={series()} label="Energy density" locale="en" />);

    const row = screen.getByText('238.0').closest('tr');
    expect(within(row as HTMLElement).getByText('Out of spec')).toBeInTheDocument();
  });

  it('treats a value above the upper limit as out of spec too', () => {
    // Both directions. A control chart that only catches the low side is one
    // that was written against a single example.
    render(
      <ControlChart
        series={series({ points: [{ started_at: '2026-07-01T06:00:00Z', value: 271 }] })}
        label="Energy density"
        locale="en"
      />,
    );

    expect(screen.getByText('Out of spec')).toBeInTheDocument();
  });

  it('treats a value exactly on a limit as in spec', () => {
    // The limits are inclusive — a reading *at* 240.0 has not breached 240.0,
    // and an off-by-one here reports a conforming batch as a failure.
    render(
      <ControlChart
        series={series({ points: [{ started_at: '2026-07-01T06:00:00Z', value: 240 }] })}
        label="Energy density"
        locale="en"
      />,
    );

    expect(screen.getByText('In spec')).toBeInTheDocument();
  });

  it('puts the unit in the column heading rather than on every cell', () => {
    render(<ControlChart series={series()} label="Energy density" locale="en" />);

    expect(screen.getByRole('columnheader', { name: 'Value (Wh/kg)' })).toBeInTheDocument();
  });

  it('takes its title from the caller, which is where the translation lives', () => {
    // The API returns `energy_density_wh_kg`. Only the dashboard's dictionary
    // knows what that is called in German, so the label is a required prop.
    render(<ControlChart series={series()} label="Energiedichte" locale="de" />);

    expect(screen.getByRole('heading', { name: 'Energiedichte' })).toBeInTheDocument();
  });

  it('renders the German verdicts on the German locale', () => {
    render(<ControlChart series={series()} label="Energiedichte" locale="de" />);

    expect(screen.getByText('Außerhalb der Spezifikation')).toBeInTheDocument();
    expect(screen.getAllByText('In Spezifikation')).toHaveLength(2);
  });

  it('renders a parameter with no target without inventing one', () => {
    // Drawing `(lower + upper) / 2` would put a target line the process
    // engineer never set exactly where they would look for the one they did.
    expect(() =>
      render(<ControlChart series={series({ target: null })} label="Energy density" locale="en" />),
    ).not.toThrow();
  });
});
