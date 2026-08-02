import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('offers the way in, and the way home', () => {
    render(<SiteHeader locale="en" />);

    expect(screen.getByRole('link', { name: 'Beff' })).toHaveAttribute('href', '/en');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/en/login');
  });

  it('carries no primary navigation — this is the pre-auth header', () => {
    // The authenticated app has its own header. A signed-out visitor offered a
    // "Dashboard" link is being offered a redirect to the login page.
    render(<SiteHeader locale="en" />);

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
  });

  it('stays in the reader’s locale, links included', () => {
    render(<SiteHeader locale="de" />);

    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/de/login');
    expect(screen.getByRole('combobox', { name: 'Darstellung' })).toBeInTheDocument();
  });
});
