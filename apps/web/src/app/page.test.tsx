import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('HomePage', () => {
  it('renders a single top-level heading', () => {
    render(<HomePage />);

    // Queried by role rather than text: this asserts the accessible structure,
    // which is what a screen reader actually navigates by.
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('wraps content in a main landmark', () => {
    render(<HomePage />);

    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
