import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('defaults to type="button" so it cannot submit a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('calls its handler on click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is reachable and activatable by keyboard alone', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  describe('loading', () => {
    it('announces the wait and marks itself busy', () => {
      render(
        <Button loading loadingLabel="Saving your changes">
          Save
        </Button>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Saving your changes')).toBeInTheDocument();
    });

    it('does not fire while loading', async () => {
      const onClick = vi.fn();
      render(
        <Button loading onClick={onClick}>
          Save
        </Button>,
      );
      await userEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('stays focusable while loading', async () => {
      // `disabled` would drop it out of the tab order mid-interaction and throw
      // focus back to the document — the user loses their place because the app
      // got slow. `aria-disabled` keeps it announced and reachable.
      render(<Button loading>Save</Button>);
      await userEvent.tab();
      expect(screen.getByRole('button')).toHaveFocus();
      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'renders the %s variant as a real button element',
    (variant) => {
      render(<Button variant={variant}>Go</Button>);
      expect(screen.getByRole('button', { name: 'Go' }).tagName).toBe('BUTTON');
    },
  );

  describe('the press', () => {
    it.each(['primary', 'secondary', 'danger'] as const)(
      'gives the %s variant a plinth to travel through',
      (variant) => {
        render(<Button variant={variant}>Go</Button>);
        const button = screen.getByRole('button', { name: 'Go' });
        // A hard-edged shadow — no blur radius — so it is a machined edge and
        // not the floating card the design brief rules out.
        expect(button.className).toContain('shadow-[0_2px_0_0_var(--plinth)]');
        // Travel matches the plinth exactly, so the control lands flush.
        expect(button.className).toContain('active:translate-y-[2px]');
        expect(button.className).toContain('active:shadow-none');
      },
    );

    it('leaves ghost flat, so it stays the quiet variant', () => {
      render(<Button variant="ghost">Go</Button>);
      // An edge would make ghost a third weight competing with secondary, which
      // is the one thing it exists not to do.
      expect(screen.getByRole('button', { name: 'Go' }).className).not.toContain('--plinth');
    });

    it('takes the plinth away when there is nothing to press', () => {
      render(
        <Button variant="primary" disabled>
          Go
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Go' });
      // Travel on a dead control invites a click that feels like it worked.
      expect(button.className).toContain('disabled:shadow-none');
      expect(button.className).toContain('disabled:active:translate-y-0');
    });

    it('animates only the compositor-friendly property', () => {
      render(<Button>Go</Button>);
      const className = screen.getByRole('button', { name: 'Go' }).className;
      // `translate`, not the `transform` shorthand — the shorthand cancels any
      // positioning utility it lands beside. And never `box-shadow`, which
      // repaints every frame.
      expect(className).toContain('transition-[background-color,border-color,translate,opacity]');
      expect(className).not.toContain('transition-[box-shadow');
    });
  });
});
