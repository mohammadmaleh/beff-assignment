import { vi, type Mock } from 'vitest';

/**
 * A typed stand-in for `fetch`.
 *
 * `vi.fn()` types its recorded calls as `any`, so reaching into
 * `mock.calls[0][1].method` trips `no-unsafe-member-access` — and that rule is
 * an error here for the same reason it is everywhere else: an `any` in a test is
 * a test that keeps compiling after the thing it checks changes shape.
 */
export interface RecordedRequest {
  url: string;
  method: string;
  body: string;
}

type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;

/**
 * The URL of a request, whatever form `fetch` was called in.
 *
 * `String(input)` is wrong for a `Request`: it stringifies to
 * `"[object Request]"`, so every handler lookup would miss and every test would
 * see a `null` body.
 */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Answer requests from a map of URL fragment to response body.
 *
 * The first fragment that appears in the URL wins, so `'/privacy/consent'` and
 * `'/privacy/export'` can answer differently within one test.
 */
export function mockFetchJson(handlers: Record<string, unknown>, ok = true): FetchMock {
  const mock: FetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    const key = Object.keys(handlers).find((fragment) => url.includes(fragment));
    const body = key === undefined ? null : handlers[key];

    return Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(body),
    } as Response);
  });

  vi.stubGlobal('fetch', mock);
  return mock;
}

/** Every request the mock recorded, in a shape that is safe to assert on. */
export function requestsOf(mock: FetchMock): RecordedRequest[] {
  return mock.mock.calls.map(([input, init]) => ({
    url: urlOf(input),
    method: init?.method ?? 'GET',
    body: typeof init?.body === 'string' ? init.body : '',
  }));
}

/** Whether the mock saw a request matching both a URL fragment and a method. */
export function sawRequest(mock: FetchMock, method: string, fragment: string): boolean {
  return requestsOf(mock).some(
    (request) => request.method === method && request.url.includes(fragment),
  );
}
