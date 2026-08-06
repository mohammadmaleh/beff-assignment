import { vi, type Mock } from 'vitest';

/**
 * A typed stand-in for `fetch`.
 *
 * `vi.fn()` types its recorded calls as `any`, so reaching into
 * `mock.calls[0][1].method` trips `no-unsafe-member-access` - and that rule is
 * an error here for the same reason it is everywhere else: an `any` in a test is
 * a test that keeps compiling after the thing it checks changes shape.
 */
export interface RecordedRequest {
  url: string;
  method: string;
  body: string;
  /** Lower-cased header names, so an assertion cannot pass or fail on casing. */
  headers: Record<string, string>;
  credentials: RequestCredentials | undefined;
}

/** `RequestInit.headers` in any of its three forms, flattened and lower-cased. */
function headersOf(init: RequestInit | undefined): Record<string, string> {
  const flat: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, name) => {
    flat[name.toLowerCase()] = value;
  });
  return flat;
}

export type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;

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

/**
 * One stubbed response.
 *
 * `contentType` is not decoration: `problemFieldErrors` returns `{}` for
 * anything that is not `application/problem+json`, so a test that stubs a
 * validation failure with the wrong content type asserts the *fallback* path
 * while appearing to assert the field-error one.
 */
export interface StubResponse {
  status?: number;
  body?: unknown;
  contentType?: string;
  /** Fail the way a dropped connection does - `fetch` rejects, it does not resolve. */
  networkError?: boolean;
}

/** A stub, or a function returning one, so a fragment can answer differently per call. */
export type Stub = StubResponse | (() => StubResponse);

/**
 * Answer requests from a map of URL fragment to a full response description.
 *
 * `mockFetchJson` covers the common case where every route answers 200 with a
 * body. This is for the cases where the *status* and the *content type* are the
 * thing under test - a 401 that must not be reported as a field error, a
 * problem document that must be, an HTML error page from a proxy that must not.
 *
 * An unmatched URL answers 404 rather than 200-with-null, so a test whose
 * fragment is wrong fails instead of silently exercising an empty payload.
 */
export function mockFetch(handlers: Record<string, Stub>): FetchMock {
  const mock: FetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    const key = Object.keys(handlers).find((fragment) => url.includes(fragment));
    const entry = key === undefined ? undefined : handlers[key];
    const stub: StubResponse =
      entry === undefined ? { status: 404 } : typeof entry === 'function' ? entry() : entry;

    if (stub.networkError === true) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }

    const status = stub.status ?? 200;
    return Promise.resolve({
      ok: status < 400,
      status,
      headers: new Headers({ 'content-type': stub.contentType ?? 'application/json' }),
      json: () =>
        stub.body === undefined
          ? Promise.reject(new SyntaxError('Unexpected end of JSON input'))
          : Promise.resolve(stub.body),
    } as Response);
  });

  vi.stubGlobal('fetch', mock);
  return mock;
}

/** An RFC 9457 problem document with a per-field breakdown, as the API renders it. */
export function problemResponse(
  status: number,
  errors: readonly { field: string; code: string }[],
): StubResponse {
  return {
    status,
    contentType: 'application/problem+json',
    body: { type: 'about:blank', title: 'Validation failed', status, errors },
  };
}

/** Every request the mock recorded, in a shape that is safe to assert on. */
export function requestsOf(mock: FetchMock): RecordedRequest[] {
  return mock.mock.calls.map(([input, init]) => ({
    url: urlOf(input),
    method: init?.method ?? 'GET',
    body: typeof init?.body === 'string' ? init.body : '',
    headers: headersOf(init),
    credentials: init?.credentials,
  }));
}

/** Whether the mock saw a request matching both a URL fragment and a method. */
export function sawRequest(mock: FetchMock, method: string, fragment: string): boolean {
  return requestsOf(mock).some(
    (request) => request.method === method && request.url.includes(fragment),
  );
}
