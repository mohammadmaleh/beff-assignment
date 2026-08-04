import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PROCESS_STEPS } from '@/lib/metrics';

import { CostOfPosition } from './CostOfPosition';

describe('CostOfPosition', () => {
  it('carries every step in the table, in process order', () => {
    // The table is the authoritative rendering and the drawing is an index into
    // it — same inversion as ScrapChart, so the two cannot disagree.
    render(<CostOfPosition locale="en" />);

    const rows = screen.getAllByRole('rowheader');
    expect(rows).toHaveLength(PROCESS_STEPS.length);
    expect(rows[0]).toHaveTextContent('Mixing');
    expect(rows.at(-1)).toHaveTextContent('End-of-line test');
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

  it('reaches the finished cell at the last step', () => {
    render(<CostOfPosition locale="en" />);

    const cells = screen.getAllByRole('cell');
    expect(cells.at(-1)).toHaveTextContent('100%');
  });

  it('is German on the German page, formatting included', () => {
    const { container } = render(<CostOfPosition locale="de" />);

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
