import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingHero } from './LandingHero';

describe('LandingHero', () => {
  it('leads with the film, named in words rather than left as "video"', () => {
    /*
     * The hero used to lead with the tolerance band at full scale. The film
     * replaced it on request.
     *
     * A `<video>` has no intrinsic accessible name — unlabelled it is announced
     * as "video" and nothing else — so the label is the element's entire
     * identity to a screen reader, and `VideoPlayer` requires it with no
     * default for exactly that reason.
     */
    render(<LandingHero locale="en" />);

    expect(screen.getByLabelText('Beff company introduction film')).toBeInTheDocument();
  });

  it('does not autoplay, and reserves its box before the file loads', () => {
    /*
     * 71 seconds with an audio track, 3.9 MB, unasked, in the hero: it would be
     * the page's largest contentful paint and a `prefers-reduced-motion` failure
     * in the same move. `preload="metadata"` fetches the header and stops.
     *
     * `width`/`height` are the master's intrinsic size, so the column does not
     * collapse and reflow when metadata arrives — a layout shift in the hero is
     * the most expensive one on the page.
     */
    render(<LandingHero locale="en" />);
    const video = screen.getByLabelText('Beff company introduction film');

    expect(video).not.toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(video).toHaveAttribute('width', '640');
    expect(video).toHaveAttribute('height', '360');
  });

  it('caps the film at its master width rather than upscaling it', () => {
    // The master is 640x360 and the hero column is wider than that on any
    // desktop viewport. Uncapped, the first thing a visitor sees is a ~2x
    // upscale — soft at exactly the moment the page makes its first claim.
    render(<LandingHero locale="en" />);

    expect(screen.getByLabelText('Beff company introduction film')).toHaveClass('max-w-[640px]');
  });

  it('has exactly one h1, and it is the positioning line', () => {
    render(<LandingHero locale="en" />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Find the scrap before it reaches formation.');
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

  it('names the film in German on the German page', () => {
    /*
     * The label is the video's whole accessible content, so an English default
     * here would be a WCAG 3.1.2 failure inside a `lang="de"` document — the
     * exact shape of the bug the screen-reader pass found on the spec band's
     * readout, which is why `VideoPlayer` takes the string as a required prop.
     * Nothing else would catch it: axe is indifferent to which language a
     * well-formed string is in, and so is every screenshot.
     */
    render(<LandingHero locale="de" />);

    expect(screen.getByLabelText('Beff Unternehmensfilm')).toBeInTheDocument();
    expect(screen.queryByLabelText(/introduction film/)).not.toBeInTheDocument();
  });
});
