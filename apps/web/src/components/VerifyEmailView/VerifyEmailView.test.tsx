import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VerifyEmailView } from './VerifyEmailView';

let search = new URLSearchParams('token=a-valid-looking-token');

vi.mock('next/navigation', () => ({
  useSearchParams: () => search,
}));

/**
 * Answer the verify call with a given status.
 *
 * The argument is narrowed rather than `String(input)`-ed: a `Request` object
 * stringifies to `"[object Request]"`, so the URL check would miss on every
 * call and the mock would throw instead of responding.
 */
const mockApi = (status: number, body: unknown = {}): ReturnType<typeof vi.fn> => {
  const spy = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/auth/verify-email')) throw new Error(`unexpected call: ${url}`);
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
  });
  vi.stubGlobal('fetch', spy);
  return spy;
};

describe('VerifyEmailView', () => {
  beforeEach(() => {
    search = new URLSearchParams('token=a-valid-looking-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('confirms the address when the link is good', async () => {
    mockApi(200, { verified: true });

    render(<VerifyEmailView locale="en" />);

    expect(await screen.findByText(/that is done/i)).toBeInTheDocument();
  });

  it('posts rather than gets', async () => {
    /*
     * Redeeming a single-use token is a state change. A GET would be prefetched
     * by mail clients and retried by proxies, spending the token before the
     * reader ever clicked it.
     */
    const spy = mockApi(200, { verified: true });

    render(<VerifyEmailView locale="en" />);
    await screen.findByText(/that is done/i);

    const [, init] = spy.mock.calls[0] as [unknown, RequestInit];
    expect(init.method).toBe('POST');
    // See the note in `UnverifiedBanner.test.tsx`: `BodyInit` is not a string.
    expect(typeof init.body).toBe('string');
    expect(JSON.parse(init.body as string)).toEqual({ token: 'a-valid-looking-token' });
  });

  it('never asks the API for a session', async () => {
    /*
     * The page is reached from a mail client that very likely has none, and a
     * link that arrives by email and produces one is a login bypass for anyone
     * who can read the inbox.
     */
    const spy = mockApi(200, { verified: true });

    render(<VerifyEmailView locale="en" />);
    await screen.findByText(/that is done/i);

    expect(spy).toHaveBeenCalledTimes(1);
    const [url] = spy.mock.calls[0] as [string];
    expect(url).not.toContain('/auth/refresh');
  });

  it('spends the token exactly once', async () => {
    /*
     * StrictMode mounts effects twice in development. Without the guard the
     * second run consumes the token the first just spent, and the page reports
     * an invalid link on a perfectly good one - in development only, which is
     * the worst place to debug it from.
     */
    const spy = mockApi(200, { verified: true });

    const { rerender } = render(<VerifyEmailView locale="en" />);
    rerender(<VerifyEmailView locale="en" />);
    await screen.findByText(/that is done/i);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('tells an expired link apart from an invalid one', async () => {
    /*
     * Different recoveries. "Ask for a new one" is right for an expired link;
     * "check what you pasted" is right for a truncated one.
     */
    mockApi(422, { code: 'auth.verification_token_expired' });

    render(<VerifyEmailView locale="en" />);

    expect(await screen.findByText(/last 24 hours/i)).toBeInTheDocument();
  });

  it('reports an invalid link', async () => {
    mockApi(422, { code: 'auth.verification_token_invalid' });

    render(<VerifyEmailView locale="en" />);

    expect(await screen.findByText(/already have been used/i)).toBeInTheDocument();
  });

  it('switches on the stable code, not on English prose', async () => {
    /*
     * The `detail` field is a sentence someone will reword. The `code` is the
     * contract, which is the entire reason the API carries one.
     */
    mockApi(422, {
      code: 'auth.verification_token_expired',
      detail: 'Completely different wording that nobody parsed.',
    });

    render(<VerifyEmailView locale="en" />);

    expect(await screen.findByText(/last 24 hours/i)).toBeInTheDocument();
  });

  it('does not blame the link when the network drops', async () => {
    /*
     * Saying "this link is invalid" on a dropped connection sends the reader
     * off to request a replacement for a link that is fine.
     */
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    render(<VerifyEmailView locale="en" />);

    expect(await screen.findByText(/could not confirm/i)).toBeInTheDocument();
    expect(screen.queryByText(/already have been used/i)).not.toBeInTheDocument();
  });

  it('survives a body that is not JSON', async () => {
    /*
     * A 502 from a proxy is an HTML error page. `response.json()` rejects on it,
     * and an unhandled rejection there would leave the page stuck on
     * "confirming…" forever with nothing in the console to explain it.
     */
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('<html>gateway</html>', { status: 502 }))),
    );

    render(<VerifyEmailView locale="en" />);

    expect(await screen.findByText(/could not confirm/i)).toBeInTheDocument();
  });

  it('asks for a link when the page is opened without one', () => {
    /*
     * Reachable by anyone who bookmarks the page or lands on it from history.
     * Firing the request with `token=null` would report an invalid link, which
     * is the wrong story.
     */
    const spy = mockApi(200, { verified: true });
    search = new URLSearchParams();

    render(<VerifyEmailView locale="en" />);

    expect(screen.getByText(/open the link in the confirmation email/i)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('reads in German on a German page', async () => {
    /*
     * The email is rendered in the reader's language and the link carries that
     * locale, so landing on an English page would undo the whole point.
     */
    mockApi(200, { verified: true });

    render(<VerifyEmailView locale="de" />);

    expect(await screen.findByText(/Das war es/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /E-Mail-Adresse bestätigen/ })).toBeInTheDocument();
  });

  it('sends a confirmed reader onward and everyone else to the login', async () => {
    mockApi(200, { verified: true });

    const { unmount } = render(<VerifyEmailView locale="en" />);
    await screen.findByText(/that is done/i);
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/en/dashboard',
    );
    unmount();

    mockApi(422, { code: 'auth.verification_token_expired' });
    render(<VerifyEmailView locale="en" />);
    await screen.findByText(/last 24 hours/i);
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/en/login');
  });

  it('announces the outcome rather than replacing a live region with silence', async () => {
    /*
     * The alert takes the place of the "confirming your address…" status. An
     * Alert that did not announce would leave a screen-reader user with the
     * wait spoken and the result never mentioned.
     */
    mockApi(200, { verified: true });

    render(<VerifyEmailView locale="en" />);

    const outcome = await screen.findByText(/that is done/i);
    // `role="status"` is an implicit `aria-live="polite"`; the Alert sets the
    // role rather than the attribute, so asserting on the attribute alone would
    // fail against markup that announces perfectly.
    expect(outcome.closest('[role="status"], [role="alert"], [aria-live]')).not.toBeNull();
  });
});
