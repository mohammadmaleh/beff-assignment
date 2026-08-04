import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChartFigure } from './ChartFigure';

/**
 * The frame's whole job is the accessible half of a chart. These assertions are
 * about what a screen reader reaches, which is the part no screenshot and no
 * axe run can check for meaning.
 */

function renderFigure(overrides: Partial<Parameters<typeof ChartFigure>[0]> = {}) {
  return render(
    <ChartFigure
      id="test-chart"
      title="First-pass yield, batch by batch"
      description="Each point is one production run."
      showTableLabel="Show the data as a table"
      tableCaption="First-pass yield by batch"
      chart={<div data-testid="drawing" aria-hidden="true" />}
      table={
        <tbody>
          <tr>
            <th scope="row">B-2026-001</th>
            <td>71.8%</td>
          </tr>
        </tbody>
      }
      {...overrides}
    />,
  );
}

describe('ChartFigure', () => {
  it('renders the chart inside a figure with a real caption', () => {
    renderFigure();

    expect(screen.getByRole('figure')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'First-pass yield, batch by batch' }),
    ).toBeInTheDocument();
  });

  it('always shows the description, never hides it behind a tooltip', () => {
    // How to read the chart is not a progressive disclosure. A reader who
    // cannot see the drawing needs it more than one who can, not less.
    renderFigure();

    expect(screen.getByText('Each point is one production run.')).toBeVisible();
  });

  it('exposes the numbers as a real table', () => {
    renderFigure();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'B-2026-001' })).toBeInTheDocument();
  });

  it('names the table with a caption rather than leaving it anonymous', () => {
    // A table is announced by its caption. Without one, a reader arriving at it
    // from the rotor gets "table, 4 columns" and no idea which chart it belongs
    // to — and this page has five.
    renderFigure();

    expect(screen.getByRole('table')).toHaveAccessibleName('First-pass yield by batch');
  });

  it('puts the table behind a native disclosure that is keyboard operable', () => {
    // `<details>` rather than a state toggle: announced as expanded or
    // collapsed, operable with the keyboard, and working before hydration.
    renderFigure();

    const summary = screen.getByText('Show the data as a table');
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.closest('details')).not.toBeNull();
  });

  it('hides the drawing from assistive technology', () => {
    // Left exposed, an ECharts SVG is dozens of loose text nodes read in visual
    // order with no structure. The table is the accessible rendering.
    renderFigure();

    expect(screen.getByTestId('drawing')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the heading at the level the caller asks for', () => {
    // Charts nest inside a section that already owns an h2. A figure that
    // always emitted h2 would flatten the outline of every page it appears on.
    renderFigure({ headingLevel: 'h2' });

    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('defaults to h3, the level a chart sits at inside a section', () => {
    renderFigure();

    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });
});
