import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandMark } from './BrandMark';

describe('BrandMark', () => {
  it('announces the company, not the file', () => {
    render(<BrandMark />);
    // "Beff" is a proper noun and identical in both locales, which is why this
    // one string is allowed to be a literal. Every *other* perceivable string in
    // this repo is a required translated prop.
    expect(screen.getByRole('img', { name: 'Beff' })).toBeInTheDocument();
  });

  it('carries intrinsic dimensions, so the header does not reflow around it', () => {
    render(<BrandMark />);
    const img = screen.getByRole('img', { name: 'Beff' });
    // The asset is 132×52. Declaring it reserves the box before the bytes land;
    // without it the logo pops in and shoves the nav sideways on every cold load.
    expect(img).toHaveAttribute('width', '132');
    expect(img).toHaveAttribute('height', '52');
  });

  it('resolves to the brand asset', () => {
    render(<BrandMark />);
    const img = screen.getByRole('img', { name: 'Beff' });
    expect(img.getAttribute('src')).toContain('beff-wordmark.png');
  });

  it('takes the monochrome hook, so the dark theme can reach it', () => {
    render(<BrandMark />);
    // A raster logo cannot be re-coloured by a token the way everything else on
    // this page is. The class is the seam globals.css uses instead.
    expect(screen.getByRole('img', { name: 'Beff' })).toHaveClass('brand-mark');
  });

  it('accepts sizing from its caller', () => {
    render(<BrandMark className="h-5" />);
    expect(screen.getByRole('img', { name: 'Beff' })).toHaveClass('h-5');
  });
});
