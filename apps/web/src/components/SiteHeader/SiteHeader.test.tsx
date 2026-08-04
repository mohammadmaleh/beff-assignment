import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('offers the way in, and the way home', () => {
    render(<SiteHeader locale="en" />);

    expect(screen.getByRole('link', { name: 'Beff' })).toHaveAttribute('href', '/en');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/en/login');
  });

  it('carries none of the authenticated navigation', () => {
    // The authenticated app has its own header. A signed-out visitor offered a
    // "Dashboard" link is being offered a redirect to the login page.
    render(<SiteHeader locale="en" />);

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
  });

  it('answers the two questions a stranger arrives with', () => {
    render(<SiteHeader locale="en" />);

    // Who are you, and how do I get in.
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/en/about');
    expect(screen.getByRole('link', { name: 'Request access' })).toBeInTheDocument();
  });

  it('points the access request at an anchor that exists from every page', () => {
    render(<SiteHeader locale="en" />);
    // A bare `#waitlist` works on the landing page and silently does nothing on
    // the Impressum — and the header is on every page. The absolute path
    // navigates first, then scrolls.
    expect(screen.getByRole('link', { name: 'Request access' })).toHaveAttribute(
      'href',
      '/en#waitlist',
    );
  });

  it('names its navigation, so three landmarks are not all called "navigation"', () => {
    render(<SiteHeader locale="en" />);
    // The footer carries two more. Unlabelled, the rotor lists three
    // indistinguishable entries — the defect the duplicate banner was.
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('keeps the legal pages out of the top nav', () => {
    render(<SiteHeader locale="en" />);
    // §5 DDG is satisfied by a footer on every page, and German readers look
    // there. Promoting four legal documents would crowd out the two things a
    // visitor came for.
    expect(screen.queryByRole('link', { name: 'Imprint' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Terms of use' })).not.toBeInTheDocument();
  });

  it('stays in the reader’s locale, links included', () => {
    render(<SiteHeader locale="de" />);

    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/de/login');
    // The theme control's accessible name is its *entire* accessible content —
    // the glyph is aria-hidden — so an English name here would announce the
    // header's only icon button in the wrong language inside a lang="de"
    // document. Exactly the defect the SpecBand readout had.
    expect(screen.getByRole('button', { name: /dunkler darstellung/i })).toBeInTheDocument();
  });
});
