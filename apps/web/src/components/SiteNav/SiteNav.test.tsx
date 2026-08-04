import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SiteNav } from './SiteNav';

let pathname = '/en';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

describe('SiteNav', () => {
  beforeEach(() => {
    pathname = '/en';
  });

  it('offers the three questions a visitor arrives with, in order', () => {
    render(<SiteNav locale="en" />);

    // What does it measure, how would it reach my line, who is building it.
    const links = screen.getAllByRole('link').map((link) => link.textContent);
    expect(links).toEqual(['Product', 'Technology', 'About']);
  });

  it('points each item at its surface', () => {
    render(<SiteNav locale="en" />);

    expect(screen.getByRole('link', { name: 'Product' })).toHaveAttribute('href', '/en/product');
    expect(screen.getByRole('link', { name: 'Technology' })).toHaveAttribute(
      'href',
      '/en/technology',
    );
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/en/about');
  });

  it('marks the current page, so it is announced and not merely coloured', () => {
    pathname = '/en/technology';
    render(<SiteNav locale="en" />);

    expect(screen.getByRole('link', { name: 'Technology' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks nothing when the reader is somewhere else', () => {
    // The landing page is in the nav's world but is not one of its items, so
    // nothing should claim to be current.
    pathname = '/en';
    render(<SiteNav locale="en" />);

    expect(screen.queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
  });

  it('does not mark a sibling whose path merely starts the same way', () => {
    // A `startsWith` comparison would light up "Product" here. Exact match only.
    pathname = '/en/product/detail';
    render(<SiteNav locale="en" />);

    expect(screen.getByRole('link', { name: 'Product' })).not.toHaveAttribute('aria-current');
  });

  it('does not confuse locales', () => {
    // `/de/product` is a different page from `/en/product`, and a nav that
    // ignored the prefix would mark the wrong one on every German page.
    pathname = '/de/product';
    render(<SiteNav locale="en" />);

    expect(screen.getByRole('link', { name: 'Product' })).not.toHaveAttribute('aria-current');
  });

  it('is a labelled landmark, since the footer carries two more', () => {
    render(<SiteNav locale="en" />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('is a list, so a screen reader announces how many destinations there are', () => {
    render(<SiteNav locale="en" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('speaks German in the German locale, links included', () => {
    pathname = '/de/produkt';
    render(<SiteNav locale="de" />);

    expect(screen.getByRole('link', { name: 'Produkt' })).toHaveAttribute('href', '/de/product');
    expect(screen.getByRole('link', { name: 'Technologie' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Über uns' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
  });
});
