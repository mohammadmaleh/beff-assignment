import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteFooter } from './SiteFooter';

describe('SiteFooter', () => {
  it('puts the imprint and the privacy policy on every page', () => {
    // §5 DDG requires the imprint to be *leicht erkennbar und unmittelbar
    // erreichbar*. A German reviewer will check, and a footer that only carries
    // them on the landing page does not satisfy it.
    render(<SiteFooter locale="en" />);

    const legal = screen.getByRole('navigation', { name: 'Legal' });
    expect(legal).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Imprint' })).toHaveAttribute('href', '/en/impressum');
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
      'href',
      '/en/datenschutz',
    );
  });

  it('keeps the legal URLs German in both locales', () => {
    // Translating a legal page's URL is how you end up with two of them, and
    // the German term is what a German user looks for.
    render(<SiteFooter locale="de" />);

    expect(screen.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute(
      'href',
      '/de/datenschutz',
    );
  });

  describe('the language switch', () => {
    it('is a real link, so it is shareable and crawlable', () => {
      render(<SiteFooter locale="en" />);

      const other = screen.getByRole('link', { name: /Auf Deutsch ansehen/ });
      expect(other).toHaveAttribute('href', '/de');
    });

    it('declares the language it points at, and the language it is written in', () => {
      // `hrefLang` tells a crawler what it will find there; `lang` tells a
      // screen reader to pronounce "Auf Deutsch ansehen" as German rather than
      // as mangled English.
      render(<SiteFooter locale="en" />);

      const other = screen.getByRole('link', { name: /Auf Deutsch ansehen/ });
      expect(other).toHaveAttribute('hreflang', 'de');
      expect(other).toHaveAttribute('lang', 'de');
    });

    it('points back the other way from the German site', () => {
      render(<SiteFooter locale="de" />);

      const other = screen.getByRole('link', { name: /View in English/ });
      expect(other).toHaveAttribute('href', '/en');
      expect(other).toHaveAttribute('hreflang', 'en');
    });
  });
});
