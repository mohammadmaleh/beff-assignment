import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Display } from './Display';

/**
 * The assertions here are on *classes*, which is normally a bad test — it
 * couples to an implementation detail and breaks on a harmless rename.
 *
 * It is the right test for exactly this component, and only this one. The
 * display face is not one class: `Archivo Expanded` does not exist as a family,
 * it is `wdth: 125` on the Archivo variable font, so a heading missing either
 * `--type-family-display` **or** `[font-stretch:125%]` renders in a real,
 * legible, wrong typeface. Nothing throws, axe is indifferent, and a screenshot
 * diff would catch it only if someone took one. The pairing *is* the contract.
 */
describe('Display', () => {
  it('sets the family and the width axis together', () => {
    render(<Display>Production intelligence</Display>);

    const heading = screen.getByRole('heading', { name: 'Production intelligence' });
    expect(heading.className).toContain('--type-family-display');
    expect(heading.className).toContain('font-stretch:125%');
  });

  it('is a section heading unless told otherwise', () => {
    render(<Display>Readings</Display>);

    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('takes the level the page needs', () => {
    render(<Display as="h1">Production overview</Display>);

    expect(screen.getByRole('heading', { level: 1, name: 'Production overview' })).toBeVisible();
  });

  it('leaves a single-line title unbalanced', () => {
    // `text-wrap: balance` on a line that does not wrap is work done for
    // nothing, and the tight leading is wrong for a page title standing alone.
    render(<Display>Profile</Display>);

    expect(screen.getByRole('heading').className).not.toContain('text-balance');
  });

  it('tightens and balances a band heading', () => {
    render(<Display balance>Where the yield went, step by step</Display>);

    const heading = screen.getByRole('heading');
    expect(heading.className).toContain('text-balance');
    expect(heading.className).toContain('leading-[1.05]');
  });

  it('tightens further at hero size, where 1.05 opens a visible gap', () => {
    render(
      <Display as="h1" size="4xl" balance>
        Know what a reading means
      </Display>,
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className).toContain('leading-[0.98]');
    expect(heading.className).not.toContain('leading-[1.05]');
  });

  it('carries the caller’s own spacing without losing the face', () => {
    render(<Display className="mt-6 max-w-4xl">Technology</Display>);

    const heading = screen.getByRole('heading');
    expect(heading.className).toContain('mt-6');
    expect(heading.className).toContain('--type-family-display');
  });

  it('keeps the id, which is what a section’s aria-labelledby points at', () => {
    render(<Display id="trend">How it got here</Display>);

    expect(screen.getByRole('heading')).toHaveAttribute('id', 'trend');
  });

  it('renders each step of the scale as its own size', () => {
    const sizes = ['lg', 'xl', '2xl', '3xl', '4xl'] as const;
    const rendered = sizes.map((size) => {
      const { container, unmount } = render(<Display size={size}>Scale</Display>);
      const className = container.firstElementChild?.className ?? '';
      unmount();
      return className;
    });

    // Five distinct sizes. A `Record` with a duplicated value would render two
    // steps of the scale identically and look deliberate.
    expect(new Set(rendered).size).toBe(sizes.length);
  });
});
