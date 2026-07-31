import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('stays in the accessibility tree', () => {
    // The whole point. `display:none` and `visibility:hidden` would remove it,
    // which is the opposite of the intent — and both are the first thing
    // someone reaches for when asked to hide text.
    render(<VisuallyHidden>Saving your changes</VisuallyHidden>);
    expect(screen.getByText('Saving your changes')).toBeInTheDocument();
  });

  it('is hidden visually', () => {
    render(<VisuallyHidden>Saving your changes</VisuallyHidden>);
    expect(screen.getByText('Saving your changes')).toHaveClass('sr-only');
  });
});
