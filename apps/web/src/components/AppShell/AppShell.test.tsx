import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthState, SessionUser } from '@/lib/auth';

import { AppShell } from './AppShell';

const replace = vi.fn();
const push = vi.fn();
const logout = vi.fn().mockResolvedValue(undefined);

let pathname = '/en/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => pathname,
}));

const USER: SessionUser = {
  id: '0198f0c0-0000-7000-8000-000000000001',
  email: 'ada@beff.example',
  display_name: 'Ada Lovelace',
  role: 'member',
  created_at: '2026-01-01T00:00:00Z',
  email_verified_at: '2026-01-01T00:00:00Z',
};

let auth: AuthState;

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, useAuth: () => auth };
});

const asSignedIn = (): void => {
  auth = { user: USER, loading: false, login: vi.fn(), register: vi.fn(), logout };
};

const asSignedOut = (): void => {
  auth = { user: null, loading: false, login: vi.fn(), register: vi.fn(), logout };
};

const asLoading = (): void => {
  auth = { user: null, loading: true, login: vi.fn(), register: vi.fn(), logout };
};

describe('AppShell', () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
    logout.mockClear();
    pathname = '/en/dashboard';
    asSignedIn();
  });

  describe('the gate', () => {
    it('announces the wait instead of showing a bare spinner', () => {
      asLoading();
      render(
        <AppShell locale="en">
          <p>secret</p>
        </AppShell>,
      );

      expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    });

    it('does not render the children while the session is still unknown', () => {
      // Rendering them and hiding them later would put an authenticated
      // surface in the DOM for anyone who looked.
      asLoading();
      render(
        <AppShell locale="en">
          <p>secret</p>
        </AppShell>,
      );

      expect(screen.queryByText('secret')).not.toBeInTheDocument();
    });

    it('does not redirect while loading — that would bounce a signed-in user on every reload', () => {
      asLoading();
      render(
        <AppShell locale="en">
          <p>secret</p>
        </AppShell>,
      );

      expect(replace).not.toHaveBeenCalled();
    });

    it('sends a signed-out visitor to login, in their own locale', async () => {
      asSignedOut();
      render(
        <AppShell locale="de">
          <p>secret</p>
        </AppShell>,
      );

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/de/login');
      });
    });

    it('replaces rather than pushes, so Back does not return to a page they cannot see', async () => {
      asSignedOut();
      render(
        <AppShell locale="en">
          <p>secret</p>
        </AppShell>,
      );

      await waitFor(() => {
        expect(replace).toHaveBeenCalled();
      });
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('renders the primary nav for a signed-in user', () => {
      render(
        <AppShell locale="en">
          <p>content</p>
        </AppShell>,
      );

      const nav = screen.getByRole('navigation', { name: 'Main' });
      expect(nav).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/en/dashboard',
      );
      expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/en/profile');
    });

    it('marks the current page with aria-current, not with the underline alone', () => {
      // The underline says "you are here" to sighted users only.
      render(
        <AppShell locale="en">
          <p>content</p>
        </AppShell>,
      );

      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current');
    });

    it('moves aria-current with the path', () => {
      pathname = '/en/profile';
      render(
        <AppShell locale="en">
          <p>content</p>
        </AppShell>,
      );

      expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    });

    it('keeps the whole frame in the reader’s locale', () => {
      pathname = '/de/dashboard';
      render(
        <AppShell locale="de">
          <p>content</p>
        </AppShell>,
      );

      expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
      // The label is German; the path segment deliberately is not. Translating
      // a URL is how you end up with two of every page.
      expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/de/profile');
      expect(screen.getByRole('link', { name: 'Übersicht' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();
    });

    it('omits the onboarding surface from the nav', () => {
      // A one-time flow with an escape hatch mid-wizard is how a
      // half-configured account happens.
      render(
        <AppShell locale="en">
          <p>content</p>
        </AppShell>,
      );

      expect(screen.queryByRole('link', { name: 'Set up your line' })).not.toBeInTheDocument();
    });
  });

  describe('the bare variant', () => {
    it('drops the chrome entirely for the onboarding wizard', () => {
      render(
        <AppShell locale="en" bare>
          <p>content</p>
        </AppShell>,
      );

      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    });

    it('still renders the children into the skip-link target', () => {
      const { container } = render(
        <AppShell locale="en" bare>
          <p>content</p>
        </AppShell>,
      );

      const main = container.querySelector('main#main');
      expect(main).not.toBeNull();
      expect(main).toHaveTextContent('content');
    });
  });

  it('signs out and then leaves, in that order', async () => {
    render(
      <AppShell locale="en">
        <p>content</p>
      </AppShell>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en');
    });
    expect(logout).toHaveBeenCalledOnce();
    // Navigating before the session is cleared would race the redirect against
    // the state update and could land back on an authenticated surface.
    const [logoutOrder] = logout.mock.invocationCallOrder;
    const [replaceOrder] = replace.mock.invocationCallOrder;
    expect(logoutOrder).toBeDefined();
    expect(replaceOrder).toBeDefined();
    expect(logoutOrder ?? 0).toBeLessThan(replaceOrder ?? 0);
  });
});
