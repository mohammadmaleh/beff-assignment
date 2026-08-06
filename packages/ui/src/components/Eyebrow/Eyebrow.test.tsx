import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Eyebrow } from './Eyebrow';

describe('Eyebrow', () => {
  it('keeps the letter-spacing that makes uppercase at xs readable', () => {
    // The one genuinely load-bearing value here. Uppercase at this size without
    // added tracking is measurably harder to read - and a copy that lost it
    // would look intentional rather than broken.
    const { container } = render(<Eyebrow>Production line</Eyebrow>);

    expect(container.firstElementChild?.className).toContain('tracking-[0.14em]');
    expect(container.firstElementChild?.className).toContain('uppercase');
  });

  it('is a paragraph, never a heading', () => {
    // An eyebrow above a heading is not a heading. Marked up as one it puts a
    // two-word fragment into the outline above the title it introduces, and a
    // reader navigating by heading lands on the kicker instead of the section.
    render(<Eyebrow>Production line</Eyebrow>);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('Production line').tagName).toBe('P');
  });

  it('can be a span where it sits inside other text', () => {
    render(<Eyebrow as="span">01</Eyebrow>);

    expect(screen.getByText('01').tagName).toBe('SPAN');
  });

  it('carries the caller’s layout classes', () => {
    const { container } = render(<Eyebrow className="flex justify-between">Mixing</Eyebrow>);

    expect(container.firstElementChild?.className).toContain('flex');
    expect(container.firstElementChild?.className).toContain('tracking-[0.14em]');
  });

  it('keeps an id, which a figcaption is named by', () => {
    const { container } = render(<Eyebrow id="cost-of-position">Committed value</Eyebrow>);

    expect(container.firstElementChild).toHaveAttribute('id', 'cost-of-position');
  });
});
