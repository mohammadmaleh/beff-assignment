import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert } from './Alert';

describe('Alert', () => {
  it('interrupts for a failure', () => {
    render(<Alert tone="danger" title="Export failed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Export failed');
  });

  it('waits for a pause for anything that is not a failure', () => {
    render(<Alert tone="success" title="Export ready" />);
    expect(screen.getByRole('status')).toHaveTextContent('Export ready');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not announce a purely informational note', () => {
    render(<Alert tone="info" title="Nothing to show yet" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['success', 'Success'],
    ['warning', 'Warning'],
    ['danger', 'Error'],
  ] as const)('names the %s tone in words, not just in colour', (tone, prefix) => {
    // Roughly one man in twelve cannot separate the success green from the
    // danger red. The word is what carries the meaning.
    render(<Alert tone={tone} title="Something happened" />);
    expect(screen.getByText(`${prefix}:`)).toBeInTheDocument();
  });

  it('renders its body', () => {
    render(
      <Alert title="Heads up">
        <p>Details here.</p>
      </Alert>,
    );
    expect(screen.getByText('Details here.')).toBeInTheDocument();
  });
});
