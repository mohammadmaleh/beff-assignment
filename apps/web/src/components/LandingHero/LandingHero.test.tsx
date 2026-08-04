import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingHero } from './LandingHero';

describe('LandingHero', () => {
  it('leads with a reading, and the reading is out of spec', () => {
    // The design brief's first instruction: the signature element at full scale
    // showing one honest reading. The first implementation shipped a headline
    // and two buttons, which is what made the page read as a document.
    render(<LandingHero locale="en" />);

    expect(screen.getByRole('figure')).toHaveTextContent('78.4');
    expect(screen.getByText(/out of spec, below the lower limit/)).toBeInTheDocument();
  });

  it('has exactly one h1, and it is the positioning line', () => {
    render(<LandingHero locale="en" />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Find the scrap before it reaches formation.');
  });

  it('plots the reading on the track rather than clamped to its edge', () => {
    /*
     * `SpecBand` clamps a wild reading to the edge so it cannot draw outside the
     * viewport. 78.4 against a default domain of 79–103 would clamp to zero and
     * the hero would show its headline figure pinned against the axis, which
     * looks like a bug and understates the reading. The explicit domain is what
     * prevents that, so it is asserted rather than trusted.
     */
    const { container } = render(<LandingHero locale="en" />);
    const tick = container.querySelector<HTMLElement>('[data-part="tick"]');

    const position = Number.parseFloat(tick!.style.insetInlineStart);
    expect(position).toBeGreaterThan(5);
    expect(position).toBeLessThan(95);
  });

  it('opts into the page’s one animation, which lives in the stylesheet', () => {
    // `packages/ui` deliberately does not animate on mount — twelve bands do
    // that at once on the dashboard. The hook is what limits the moment to here.
    const { container } = render(<LandingHero locale="en" />);
    expect(container.querySelector('[data-band-draw]')).toBeInTheDocument();
  });

  it('links the secondary call to action at the argument, not at nothing', () => {
    // "See what it measures" has to land on the figure that answers it. An
    // anchor pointing at a removed id scrolls nowhere and reports no error.
    render(<LandingHero locale="en" />);

    expect(screen.getByRole('link', { name: /See what it measures/ })).toHaveAttribute(
      'href',
      '#cost',
    );
    // Absolute, matching the header's button character for character. A link
    // rotor compares destinations as written, so `#waitlist` here against
    // `/en#waitlist` there would list two entries with one name and two
    // apparent destinations.
    expect(screen.getByRole('link', { name: /Request access/ })).toHaveAttribute(
      'href',
      '/en#waitlist',
    );
  });

  it('announces the reading in German on the German page', () => {
    // The bar is aria-hidden, so this readout is the entire accessible content
    // of the hero's instrument. This is the WCAG 3.1.2 failure the screen-reader
    // pass found, asserted at the place it would come back.
    render(<LandingHero locale="de" />);

    expect(
      screen.getByText(/außerhalb der Spezifikation, unter der unteren Grenze/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/out of spec/)).not.toBeInTheDocument();
  });
});
