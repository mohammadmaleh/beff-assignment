import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PROCESS_STEPS } from '@/lib/metrics';

import { CostOfPosition } from './CostOfPosition';

describe('CostOfPosition', () => {
  it('carries every step in the table, in process order', async () => {
    // The table is the authoritative rendering and the drawing is an index into
    // it — same inversion as ScrapChart, so the two cannot disagree.
    render(<CostOfPosition locale="en" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Table' }));

    const rows = screen.getAllByRole('rowheader');
    expect(rows).toHaveLength(PROCESS_STEPS.length);
    expect(rows[0]).toHaveTextContent('Mixing');
    expect(rows.at(-1)).toHaveTextContent('End-of-line test');
  });

  it('offers the table as a named view, like every other figure in the app', async () => {
    /*
     * This figure sits directly below `ProductPanel`'s scrap chart on the
     * landing page. While that one had a Chart/Table switch and this one kept a
     * grey `<details>` line, the same page offered the same affordance in two
     * different shapes — which reads as an oversight, because it was one.
     */
    render(<CostOfPosition locale="en" />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Chart', 'Table']);
    expect(screen.queryByText('Show the data as a table')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Table' }));

    expect(within(screen.getByRole('table')).getAllByRole('rowheader').length).toBeGreaterThan(0);
  });

  it('describes the shape in words, since the drawing is hidden', () => {
    render(<CostOfPosition locale="en" />);

    expect(screen.getByRole('figure')).toHaveTextContent(
      /rises from 7 per cent .* to 100 per cent/,
    );
  });

  it('hides the drawing from assistive technology', () => {
    const { container } = render(<CostOfPosition locale="en" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('annotates the two steps the copy argues from', () => {
    // The body text compares formation against coating. The drawing has to mark
    // the same two, or the reader is asked to find them in an unlabelled figure.
    const { container } = render(<CostOfPosition locale="en" />);

    expect(container.textContent).toContain('90% · Formation');
    expect(container.textContent).toContain('21% · Coating');
  });

  it('reaches the finished cell at the last step', async () => {
    render(<CostOfPosition locale="en" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Table' }));

    const cells = screen.getAllByRole('cell');
    expect(cells.at(-1)).toHaveTextContent('100%');
  });

  it('is German on the German page, formatting included', async () => {
    const { container } = render(<CostOfPosition locale="de" />);

    // The tab itself is translated — the switch is copy like any other, and an
    // English default here would ship silently onto the German page.
    await userEvent.click(screen.getByRole('tab', { name: 'Tabelle' }));

    expect(screen.getAllByRole('rowheader')[0]).toHaveTextContent('Mischen');
    /*
     * German puts a space before the per-cent sign and `Intl` uses a
     * **non-breaking** one, which is the whole reason to format rather than
     * concatenate: a hard-coded '%' would render `90%` in German, and a
     * hard-coded ' %' would let the sign wrap onto its own line.
     */
    expect(container.textContent).toContain('90 % · Formierung');
    expect(container.textContent).toContain('Zelle fertig');
  });
});
