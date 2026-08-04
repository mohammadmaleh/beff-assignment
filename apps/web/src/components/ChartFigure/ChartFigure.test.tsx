import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      viewChartLabel="Chart"
      viewTableLabel="Table"
      chart={<div data-testid="drawing" aria-hidden="true" />}
      table={
        <table>
          <caption>First-pass yield by batch</caption>
          <tbody>
            <tr>
              <th scope="row">B-2026-001</th>
              <td>71.8%</td>
            </tr>
          </tbody>
        </table>
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

  it('exposes the numbers as a real table', async () => {
    const user = userEvent.setup();
    renderFigure();

    await user.click(screen.getByRole('tab', { name: 'Table' }));

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'B-2026-001' })).toBeInTheDocument();
  });

  it('names the table with a caption rather than leaving it anonymous', async () => {
    // A table is announced by its caption. Without one, a reader arriving at it
    // from the rotor gets "table, 4 columns" and no idea which chart it belongs
    // to — and this page has five.
    const user = userEvent.setup();
    renderFigure();

    await user.click(screen.getByRole('tab', { name: 'Table' }));

    expect(screen.getByRole('table')).toHaveAccessibleName('First-pass yield by batch');
  });

  it('offers the chart and the table as two named views, not one and a footnote', () => {
    /*
     * `<details>` was defensible while the table was an alternative. It is not
     * once the table is the authoritative rendering — the component's own
     * docstring says it is, and a grey line of text below a hairline rule says
     * otherwise to everyone who can see it.
     *
     * The pre-hydration argument for `<details>` is void on this surface: the
     * dashboard is client-rendered off React Query, so before JS runs there are
     * no rows to disclose either way.
     */
    renderFigure();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Chart', 'Table']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('shows one panel at a time and switches on click', async () => {
    const user = userEvent.setup();
    renderFigure();

    expect(screen.getByTestId('drawing')).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Table' }));

    expect(screen.getByRole('table')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Table' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves between the views with the arrow keys, as a tablist must', async () => {
    // A tablist that only responds to clicks is a set of buttons wearing the
    // wrong role, and a keyboard user is told to expect arrow keys by the role
    // itself.
    const user = userEvent.setup();
    renderFigure();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Chart' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Table' })).toHaveFocus();
    expect(screen.getByRole('table')).toBeVisible();
  });

  it('keeps the panels wired to the tabs that name them', () => {
    renderFigure();

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAccessibleName('Chart');
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
