import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthState, SessionUser } from '@/lib/auth';

import { UnverifiedBanner } from './UnverifiedBanner';

const UNVERIFIED: SessionUser = {
  id: '0198f0c0-0000-7000-8000-000000000001',
  email: 'ada@beff.example',
  display_name: 'Ada Lovelace',
  role: 'member',
  created_at: '2026-01-01T00:00:00Z',
  email_verified_at: null,
};

let auth: AuthState;

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, useAuth: () => auth };
});

const asUnverified = (): void => {
  auth = { user: UNVERIFIED, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
};

/**
 * Respond to the resend call with a given status.
 *
 * The argument is narrowed rather than `String(input)`-ed: a `Request` object
 * stringifies to `"[object Request]"`, so every URL check would miss and every
 * mocked body come back `null`.
 */
const mockApi = (status: number, body: unknown = {}): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes('/auth/verify-email/resend')) throw new Error(`unexpected call: ${url}`);
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/problem+json' },
        }),
      );
    }),
  );
};

describe('UnverifiedBanner', () => {
  beforeEach(() => {
    asUnverified();
    mockApi(202, { queued: true, recipient: UNVERIFIED.email });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing once the address is confirmed', () => {
    auth = {
      ...auth,
      user: { ...UNVERIFIED, email_verified_at: '2026-02-01T00:00:00Z' },
    };

    const { container } = render(<UnverifiedBanner locale="en" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no user', () => {
    auth = { ...auth, user: null };

    const { container } = render(<UnverifiedBanner locale="en" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('names the address the link was sent to', () => {
    render(<UnverifiedBanner locale="en" />);

    expect(screen.getByText(/ada@beff\.example/)).toBeInTheDocument();
  });

  it('is a warning, not a blocker', () => {
    /*
     * Nothing in the product is gated on a confirmed address, so the banner
     * must not read as an error or offer a dead end. A `danger` tone here would
     * be the component telling the user something is broken when nothing is.
     */
    render(<UnverifiedBanner locale="en" />);

    expect(screen.getByRole('button', { name: /send the link again/i })).toBeEnabled();
  });

  it('reads in German on a German page', () => {
    /*
     * The specific regression this project has already shipped once: a
     * component composing user-facing prose from literals, invisible to axe and
     * to every screenshot, because a well-formed English string renders
     * perfectly on a German page.
     */
    render(<UnverifiedBanner locale="de" />);

    expect(screen.getByText(/E-Mail-Adresse bestätigen/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Link erneut senden/i })).toBeInTheDocument();
  });

  it('confirms the resend in a live region', async () => {
    /*
     * A successful resend changes nothing visible except this sentence. Without
     * a live region, a screen-reader user has no way to learn the click did
     * anything at all.
     */
    render(<UnverifiedBanner locale="en" />);

    await userEvent.click(screen.getByRole('button', { name: /send the link again/i }));

    const confirmation = await screen.findByText(/on its way/i);
    // Queried by text and then checked for the live region around it. Asking
    // for `role="status"` directly would be ambiguous — the warning Alert this
    // sits inside is itself a live region, so the role matches twice.
    expect(confirmation.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('sends the locale the reader is reading the site in', async () => {
    render(<UnverifiedBanner locale="de" />);

    await userEvent.click(screen.getByRole('button', { name: /Link erneut senden/i }));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
    const [, init] = vi.mocked(fetch).mock.calls[0] as [unknown, RequestInit];
    // Narrowed, not `String(...)`-ed. `BodyInit` includes `Blob`, `FormData`
    // and a stream, every one of which stringifies to `[object Something]` —
    // a value that parses as nothing and asserts as everything.
    expect(typeof init.body).toBe('string');
    expect(JSON.parse(init.body as string)).toEqual({ locale: 'de' });
  });

  it('stops offering the button once a message is on its way', async () => {
    /*
     * A second click would be suppressed by the outbox anyway — the queued
     * message still carries a live token — so leaving the button active would
     * promise something that does not happen.
     */
    render(<UnverifiedBanner locale="en" />);

    await userEvent.click(screen.getByRole('button', { name: /send the link again/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send the link again/i })).toBeDisabled();
    });
  });

  it('says something different when the limiter refuses', async () => {
    /*
     * "Try again" is useless advice against a one-hour window, and it is the
     * message a generic failure branch would give.
     */
    mockApi(429, { code: 'rate_limited' });
    render(<UnverifiedBanner locale="en" />);

    await userEvent.click(screen.getByRole('button', { name: /send the link again/i }));

    expect(await screen.findByText(/too many/i)).toBeInTheDocument();
  });

  it('says something different when the address turns out to be confirmed', async () => {
    /*
     * Genuinely reachable: the link can be followed in another tab between this
     * page loading and the click. "Try again" would be wrong advice.
     */
    mockApi(409, { code: 'auth.email_already_verified' });
    render(<UnverifiedBanner locale="en" />);

    await userEvent.click(screen.getByRole('button', { name: /send the link again/i }));

    expect(await screen.findByText(/already confirmed/i)).toBeInTheDocument();
  });

  it('reports a failure without claiming the message was sent', async () => {
    mockApi(500, {});
    render(<UnverifiedBanner locale="en" />);

    await userEvent.click(screen.getByRole('button', { name: /send the link again/i }));

    expect(await screen.findByText(/could not send/i)).toBeInTheDocument();
    expect(screen.queryByText(/on its way/i)).not.toBeInTheDocument();
  });

  it('lets the reader try again after a failure', async () => {
    /*
     * The disable is for *success*, not for every terminal state. Leaving the
     * button dead after a 500 would strand the user on the one path where
     * retrying is exactly the right thing to do.
     */
    mockApi(500, {});
    render(<UnverifiedBanner locale="en" />);

    await userEvent.click(screen.getByRole('button', { name: /send the link again/i }));
    await screen.findByText(/could not send/i);

    expect(screen.getByRole('button', { name: /send the link again/i })).toBeEnabled();
  });
});
