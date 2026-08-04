import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { COMMITTED_VALUE_EUR, PROCESS_STEPS } from '@/lib/metrics';

import { DEMO_LINE } from './demoLine';
import { ProductPanel } from './ProductPanel';

describe('ProductPanel', () => {
  it('renders the product, not a picture of it', () => {
    // The dashboard's own components on the seeded line's own figures. A mocked
    // screenshot would be both dishonest and stale within a sprint.
    render(<ProductPanel locale="en" />);

    expect(screen.getByText('71.7')).toBeInTheDocument();
    expect(screen.getByText('27.8')).toBeInTheDocument();
    expect(screen.getByText('88.3')).toBeInTheDocument();
    expect(screen.getByText('63.9')).toBeInTheDocument();
  });

  it('shows a reading that is out of spec', () => {
    // A panel where everything is fine does not demonstrate that the product can
    // show a problem, which is the only reason to put it on the page.
    render(<ProductPanel locale="en" />);

    expect(screen.getByText(/out of spec, below the lower limit/)).toBeInTheDocument();
  });

  it('keeps the chart’s table alternative', async () => {
    // The table is a named view behind a tab now rather than an always-open
    // block, but it is still every process step — the marketing surface must
    // not ship a chart whose numbers a screen reader cannot reach.
    render(<ProductPanel locale="en" />);

    await userEvent.click(screen.getByRole('tab', { name: 'Table' }));

    const rows = screen.getAllByRole('rowheader');
    expect(rows).toHaveLength(PROCESS_STEPS.length);
  });

  it('scopes the dark palette to itself rather than inventing colours', () => {
    /*
     * The inversion is the dark theme applied to a subtree, which is why the
     * token build unscopes that selector from `:root`. Every pair inside the
     * panel is therefore a pair the contrast gate already asserts. A
     * `surface-emphasis` family would have been a second set of colours nobody
     * solved.
     */
    const { container } = render(<ProductPanel locale="en" />);
    expect(container.firstElementChild).toHaveAttribute('data-theme', 'dark');
  });

  it('labels a falling scrap rate as good news off a downward arrow', () => {
    // Yield up and scrap down are both positive. Colour follows the meaning, not
    // the direction of the glyph — the dashboard makes the same distinction.
    render(<ProductPanel locale="en" />);

    expect(screen.getByText('-5.3 pp')).toBeInTheDocument();
    expect(screen.getByText('+5.4 pp')).toBeInTheDocument();
  });

  it('is German on the German page', () => {
    render(<ProductPanel locale="de" />);

    expect(screen.getByRole('heading', { name: 'Der Blick um 08:40' })).toBeInTheDocument();
    expect(screen.getByText('Erstdurchlaufquote')).toBeInTheDocument();
    // German decimal comma, from Intl rather than from a hard-coded string.
    expect(screen.getByText('71,7')).toBeInTheDocument();
  });
});

describe('the demo line’s figures', () => {
  it('covers every process step', () => {
    expect(DEMO_LINE.scrap_by_step.map((row) => row.process_step)).toEqual([...PROCESS_STEPS]);
  });

  it('costs scrap against the value already committed at that step', () => {
    /*
     * The product's whole thesis, checkable in one assertion: coating loses more
     * cells than formation, and formation still loses more money, because a cell
     * at formation carries most of its cost already. If the euro column were
     * proportional to the percentage this would fail — and the panel would be
     * quietly arguing against the page it sits on.
     */
    const by = (step: string) => DEMO_LINE.scrap_by_step.find((r) => r.process_step === step)!;

    expect(by('coating').scrap_rate_pct).toBeGreaterThan(by('formation').scrap_rate_pct);
    expect(by('formation').committed_value_eur).toBeGreaterThan(by('coating').committed_value_eur);
    expect(COMMITTED_VALUE_EUR.formation).toBeGreaterThan(COMMITTED_VALUE_EUR.coating);
  });

  it('keeps first-pass yield inside the range a pilot line runs', () => {
    // CONTEXT.md: 40–80% on a pilot line, 85–97% on a mature one. A figure
    // outside its regime is the first thing a domain reviewer notices.
    expect(DEMO_LINE.line_kind).toBe('pilot');
    expect(DEMO_LINE.first_pass_yield_pct).toBeGreaterThanOrEqual(40);
    expect(DEMO_LINE.first_pass_yield_pct).toBeLessThanOrEqual(80);
  });
});
