import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockFetch, requestsOf, type FetchMock } from '@/test/fetchMock';

import { AuthProvider, useAuth, type AuthState } from './AuthProvider';
import { getAccessToken, setAccessToken } from './session';

const USER = {
  id: '0198f0c0-0000-7000-8000-000000000001',
  email: 'ada@beff.example',
  display_name: 'Ada Lovelace',
  role: 'member',
  created_at: '2026-01-01T00:00:00Z',
  email_verified_at: '2026-01-01T00:00:00Z',
};

const SESSION = { access_token: 'access-1', expires_in: 900, user: USER };

/**
 * A window onto the context, so the assertions read the state a real consumer
 * would see rather than the provider's internals.
 *
 * `loading` is rendered as its own word rather than folded into "no user",
 * because keeping those two apart is the whole reason the flag exists.
 */
function Probe() {
  const { user, loading, login, register, logout } = useAuth();
  return (
    <div>
      <p data-testid="state">{loading ? 'loading' : (user?.email ?? 'signed-out')}</p>
      <button
        type="button"
        onClick={() => {
          void login('ada@beff.example', 'correct horse battery staple');
        }}
      >
        log in
      </button>
      <button
        type="button"
        onClick={() => {
          void register('ada@beff.example', 'correct horse battery staple', 'Ada Lovelace');
        }}
      >
        register
      </button>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
      >
        log out
      </button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

const state = () => screen.getByTestId('state').textContent;

/** The bootstrap pair: a refresh that succeeds, then the identity call behind it. */
const signedIn = (): FetchMock =>
  mockFetch({
    '/auth/refresh': { body: { access_token: 'access-0' } },
    '/auth/me': { body: USER },
  });

describe('AuthProvider', () => {
  beforeEach(() => {
    // The access token is a module variable by design (never localStorage), so
    // it survives between tests in the same file. One test's session must not
    // authenticate the next one's request.
    setAccessToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('bootstrap', () => {
    it('starts in loading, which is not the same as signed out', async () => {
      // The distinction this asserts is the reason `loading` exists: treating
      // "no user yet" as "signed out" is how a dashboard bounces its own user
      // to the login page on every reload.
      signedIn();
      renderProvider();

      expect(state()).toBe('loading');
      await waitFor(() => {
        expect(state()).toBe('ada@beff.example');
      });
    });

    it('settles to signed out when there is no refresh cookie', async () => {
      mockFetch({ '/auth/refresh': { status: 401 } });
      renderProvider();

      await waitFor(() => {
        expect(state()).toBe('signed-out');
      });
    });

    it('sends the refresh cookie, which is on a different origin in every environment', async () => {
      const fetchMock = signedIn();
      renderProvider();
      await screen.findByText('ada@beff.example');

      const refreshCall = requestsOf(fetchMock).find((request) =>
        request.url.includes('/auth/refresh'),
      );
      expect(refreshCall?.credentials).toBe('include');
      expect(refreshCall?.method).toBe('POST');
    });

    it('attaches the refreshed access token to the identity call', async () => {
      const fetchMock = signedIn();
      renderProvider();
      await screen.findByText('ada@beff.example');

      const me = requestsOf(fetchMock).find((request) => request.url.includes('/auth/me'));
      expect(me?.headers.authorization).toBe('Bearer access-0');
    });

    it('stops loading even when the identity call fails after a good refresh', async () => {
      // Without the `finally`, this state loads forever: the refresh worked, so
      // the signed-out branch never runs, and the screen sits on "Loading…"
      // with no way out.
      //
      // Note what this does *not* gate: the `catch` beside it. Delete that and
      // this assertion still passes, because `finally` runs either way. The
      // escaping rejection is what fails then - vitest reports it as a
      // run-level unhandled error and exits 1 while every test still shows
      // green. Verified by breaking it deliberately.
      mockFetch({
        '/auth/refresh': { body: { access_token: 'access-0' } },
        '/auth/me': { status: 500 },
      });
      renderProvider();

      await waitFor(() => {
        expect(state()).toBe('signed-out');
      });
    });

    it('treats a network failure as signed out rather than throwing', async () => {
      mockFetch({ '/auth/refresh': { networkError: true } });
      renderProvider();

      await waitFor(() => {
        expect(state()).toBe('signed-out');
      });
    });
  });

  describe('login and register', () => {
    it('stores the session the login returned', async () => {
      mockFetch({
        '/auth/refresh': { status: 401 },
        '/auth/login': { body: SESSION },
      });
      renderProvider();
      await screen.findByText('signed-out');

      await userEvent.click(screen.getByRole('button', { name: 'log in' }));

      await waitFor(() => {
        expect(state()).toBe('ada@beff.example');
      });
      expect(getAccessToken()).toBe('access-1');
    });

    it('sends the password in the body, never in the URL', async () => {
      const fetchMock = mockFetch({
        '/auth/refresh': { status: 401 },
        '/auth/login': { body: SESSION },
      });
      renderProvider();
      await screen.findByText('signed-out');

      await userEvent.click(screen.getByRole('button', { name: 'log in' }));
      await screen.findByText('ada@beff.example');

      const call = requestsOf(fetchMock).find((request) => request.url.includes('/auth/login'));
      expect(call?.url).not.toContain('correct horse');
      expect(JSON.parse(call?.body ?? '{}')).toEqual({
        email: 'ada@beff.example',
        password: 'correct horse battery staple',
      });
    });

    it('registers with the API field name, not the camelCase argument name', async () => {
      // `displayName` is the argument; `display_name` is the contract. A silent
      // rename here reaches the API as a missing required field.
      const fetchMock = mockFetch({
        '/auth/refresh': { status: 401 },
        '/auth/register': { body: SESSION },
      });
      renderProvider();
      await screen.findByText('signed-out');

      await userEvent.click(screen.getByRole('button', { name: 'register' }));
      await screen.findByText('ada@beff.example');

      const call = requestsOf(fetchMock).find((request) => request.url.includes('/auth/register'));
      expect(JSON.parse(call?.body ?? '{}')).toEqual({
        email: 'ada@beff.example',
        password: 'correct horse battery staple',
        display_name: 'Ada Lovelace',
      });
    });

    it('propagates a rejected login rather than swallowing it', async () => {
      // AuthForm's entire error handling depends on this rejecting - if the
      // provider absorbed the failure, a wrong password would look like a
      // successful login that simply produced no user.
      mockFetch({
        '/auth/refresh': { status: 401 },
        '/auth/login': { status: 401 },
      });

      let capture: ReturnType<typeof useAuth> | null = null;
      function Capture() {
        capture = useAuth();
        return null;
      }
      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(capture).not.toBeNull();
      });
      const auth = capture as unknown as ReturnType<typeof useAuth>;
      await expect(auth.login('ada@beff.example', 'wrong')).rejects.toThrow(/401/);
    });
  });

  describe('logout', () => {
    it('clears the session locally even when the server call fails', async () => {
      // A logout that appears to fail and leaves the user looking signed in is
      // worse than one that clears optimistically.
      mockFetch({
        '/auth/refresh': { body: { access_token: 'access-0' } },
        '/auth/me': { body: USER },
        '/auth/logout': { status: 500 },
      });
      renderProvider();
      await screen.findByText('ada@beff.example');

      await userEvent.click(screen.getByRole('button', { name: 'log out' }));

      await waitFor(() => {
        expect(state()).toBe('signed-out');
      });
      expect(getAccessToken()).toBeNull();
    });

    it('resolves even when the server-side revoke fails', async () => {
      // A `finally` without a `catch` still rejects the promise the caller
      // holds, so `logout().then(() => router.replace(...))` silently skips its
      // redirect and the browser logs an unhandled rejection - for a call that
      // did exactly what the caller asked. This is the regression guard.
      mockFetch({
        '/auth/refresh': { status: 401 },
        '/auth/logout': { status: 401 },
      });

      let capture: AuthState | null = null;
      function Capture() {
        capture = useAuth();
        return null;
      }
      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      );
      await waitFor(() => {
        expect(capture).not.toBeNull();
      });

      await expect((capture as unknown as AuthState).logout()).resolves.toBeUndefined();
    });

    it('does not retry the logout through a refresh', async () => {
      // `retry: false` is deliberate: a 401 on logout means the session is
      // already gone, and refreshing to retry would mint a new token in order
      // to destroy it.
      const fetchMock = mockFetch({
        '/auth/refresh': { body: { access_token: 'access-0' } },
        '/auth/me': { body: USER },
        '/auth/logout': { status: 401 },
      });
      renderProvider();
      await screen.findByText('ada@beff.example');

      await userEvent.click(screen.getByRole('button', { name: 'log out' }));
      await waitFor(() => {
        expect(state()).toBe('signed-out');
      });

      const refreshes = requestsOf(fetchMock).filter((request) =>
        request.url.includes('/auth/refresh'),
      );
      expect(refreshes).toHaveLength(1);
    });
  });

  it('refuses to hand out a context that does not exist', () => {
    // Rendering the signed-out UI because a provider was forgotten would be a
    // silent failure on an authenticated surface.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/useAuth must be used inside an AuthProvider/);
    consoleError.mockRestore();
  });
});
