import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button, buttonClassName } from './Button';

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
      // focus back to the document - the user loses their place because the app
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

  describe('shape and weight', () => {
    it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
      'draws the %s variant without an outline',
      (variant) => {
        render(<Button variant={variant}>Go</Button>);
        // Weight is carried by fill. An outline around a filled button is a
        // second edge describing a boundary the fill already states.
        expect(screen.getByRole('button', { name: 'Go' }).className).not.toMatch(/\bborder\b/);
      },
    );

    it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
      'gives the %s variant no bevel',
      (variant) => {
        render(<Button variant={variant}>Go</Button>);
        // A hard plinth asks the control to imitate a physical key. It reads as
        // dated rather than as machined, which is why it is gone.
        expect(screen.getByRole('button', { name: 'Go' }).className).not.toContain('shadow-[');
      },
    );

    it('uses the control radius, not the panel one', () => {
      render(<Button>Go</Button>);
      const className = screen.getByRole('button', { name: 'Go' }).className;
      // 2px on a full-width band reads as machined; the same 2px on a 44px
      // control reads as a browser default nobody styled.
      expect(className).toContain('rounded-control');
      expect(className).not.toContain('rounded-chamfer');
    });

    it('separates secondary from the page with sunken, not raised', () => {
      render(<Button variant="secondary">Go</Button>);
      // `raised` sits ~2% off the base surface, so a borderless plate drawn on
      // it would be invisible on the very page it lives on.
      expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-surface-sunken');
    });

    it('spends no ink on danger until the pointer is on it', () => {
      render(<Button variant="danger">Go</Button>);
      const className = screen.getByRole('button', { name: 'Go' }).className;
      // Also a palette constraint: danger text clears 4.5:1 on the base surface
      // and nothing else, so it cannot carry a resting plate.
      expect(className).toContain('bg-transparent');
      expect(className).toContain('hover:bg-status-danger-fg');
    });
  });

  describe('the press', () => {
    it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
      'moves the %s variant on activation',
      (variant) => {
        render(<Button variant={variant}>Go</Button>);
        expect(screen.getByRole('button', { name: 'Go' }).className).toContain(
          'active:translate-y-px',
        );
      },
    );

    it('holds a dead control still', () => {
      render(
        <Button variant="primary" disabled>
          Go
        </Button>,
      );
      // Travel on something that cannot be activated makes a click that did
      // nothing still feel like it worked.
      expect(screen.getByRole('button', { name: 'Go' }).className).toContain(
        'disabled:active:translate-y-0',
      );
    });

    it('animates only compositor-friendly properties', () => {
      render(<Button>Go</Button>);
      const className = screen.getByRole('button', { name: 'Go' }).className;
      // `translate`, not the `transform` shorthand - the shorthand cancels any
      // positioning utility it lands beside.
      expect(className).toContain('transition-[background-color,color,translate,opacity]');
      expect(className).not.toContain('box-shadow');
    });
  });

  /*
   * A call-to-action that navigates is a link, and a link is not a button - it
   * has no `type`, no `disabled`, and it belongs in the link rotor rather than
   * the button one. So `Button` cannot render it, and before this existed the
   * app hand-rolled the primary variant as an anchor in three places. They had
   * already drifted: the 404 page's copy used `rounded-chamfer` (which this
   * component's own comment calls the wrong radius for a control), and dropped
   * the transition, the press and the minimum height.
   *
   * Exporting the classes rather than accepting a link component is what keeps
   * `@beff/ui` router-free. A `next/link` import here would make the whole
   * design system Next-only for the sake of one href.
   */
  describe('buttonClassName', () => {
    it('is the single source of the look, not a copy of it', () => {
      // The assertion that makes this a seam rather than a second definition:
      // it fails the moment someone writes a class back into the component.
      render(
        <Button variant="secondary" size="sm">
          Save
        </Button>,
      );
      expect(screen.getByRole('button', { name: 'Save' }).className).toBe(
        buttonClassName({ variant: 'secondary', size: 'sm' }),
      );
    });

    it('dresses a link as the primary control, press and all', () => {
      render(
        <a href="/waitlist" className={buttonClassName()}>
          Request access
        </a>,
      );
      const className = screen.getByRole('link', { name: 'Request access' }).className;
      expect(className).toContain('bg-brand-default');
      expect(className).toContain('text-text-on-brand');
      expect(className).toContain('active:translate-y-px');
      // The height a touch target needs. The hand-rolled 404 copy had none.
      expect(className).toContain('min-h-11');
    });

    it('gives a link the control radius rather than the band chamfer', () => {
      expect(buttonClassName()).toContain('rounded-control');
      expect(buttonClassName()).not.toContain('rounded-chamfer');
    });

    it('appends the caller’s own classes last, so they win', () => {
      expect(buttonClassName({ className: 'w-full' }).endsWith('w-full')).toBe(true);
    });
  });
});
