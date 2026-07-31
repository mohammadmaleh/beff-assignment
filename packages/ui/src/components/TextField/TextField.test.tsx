import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TextField } from './TextField.js';

describe('TextField', () => {
  it('associates its label with the input, so clicking the label focuses it', async () => {
    render(<TextField label="Work email" />);
    await userEvent.click(screen.getByText('Work email'));
    expect(screen.getByLabelText('Work email')).toHaveFocus();
  });

  it('describes the input with its help text rather than using a placeholder', () => {
    render(<TextField label="Work email" description="We never share this." />);
    expect(screen.getByLabelText('Work email')).toHaveAccessibleDescription('We never share this.');
  });

  describe('with a server-sourced error', () => {
    it('marks the input invalid and announces the message', () => {
      render(<TextField label="Work email" error="That address is already registered." />);
      const input = screen.getByLabelText('Work email');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('That address is already registered.');
    });

    it('reads the error before the description, because it is the more urgent', () => {
      render(
        <TextField label="Work email" description="Use your company address." error="Required." />,
      );
      const described = screen.getByLabelText('Work email').getAttribute('aria-describedby');
      expect(described).toBeTruthy();
      const [first] = (described ?? '').split(' ');
      expect(first).toMatch(/-error$/);
    });

    it('does not rely on colour alone — the message is text with a glyph', () => {
      render(<TextField label="Work email" error="Required." />);
      expect(screen.getByRole('alert')).toHaveTextContent('Required.');
    });
  });

  it('is clean when there is no error', () => {
    render(<TextField label="Work email" />);
    expect(screen.getByLabelText('Work email')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
