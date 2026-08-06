import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Lede } from './Lede';

describe('Lede', () => {
  it('always constrains the measure', () => {
    // The class a paste drops silently. Without it the paragraph is not broken,
    // it is *wider* - which looks fine on a laptop and becomes a line the eye
    // cannot track back from on a 1440px screen.
    const { container } = render(<Lede>Cell manufacturing runs on readings.</Lede>);

    expect(container.firstElementChild?.className).toContain('--type-prose-measure');
  });

  it('carries prose leading at reading size', () => {
    const { container } = render(<Lede>Cell manufacturing runs on readings.</Lede>);

    expect(container.firstElementChild?.className).toContain('--type-prose-leading');
  });

  it('leaves a supporting note on the UI leading', () => {
    // A two-line figure description on prose leading reads as two paragraphs.
    const { container } = render(<Lede size="sm">Batch-by-batch, against the window.</Lede>);

    expect(container.firstElementChild?.className).not.toContain('--type-prose-leading');
    expect(container.firstElementChild?.className).toContain('--type-ui-size-sm');
  });

  it('renders each size as its own step', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    const rendered = sizes.map((size) => {
      const { container, unmount } = render(<Lede size={size}>Measure</Lede>);
      const className = container.firstElementChild?.className ?? '';
      unmount();
      return className;
    });

    expect(new Set(rendered).size).toBe(sizes.length);
  });

  it('carries the caller’s spacing and rules', () => {
    const { container } = render(<Lede className="border-t pt-4">Note</Lede>);

    expect(container.firstElementChild?.className).toContain('border-t');
    expect(container.firstElementChild?.className).toContain('--type-prose-measure');
  });

  it('is a paragraph by default and keeps its id', () => {
    render(
      <Lede id="lede">
        Cell manufacturing runs on readings, and a reading alone means nothing.
      </Lede>,
    );

    const lede = screen.getByText(/Cell manufacturing/);
    expect(lede.tagName).toBe('P');
    expect(lede).toHaveAttribute('id', 'lede');
  });
});
