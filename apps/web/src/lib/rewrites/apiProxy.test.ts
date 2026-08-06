import { describe, expect, it } from 'vitest';

import { API_PROXY_SOURCE, apiProxyRewrites } from './apiProxy';

/*
 * These assertions exist because every failure mode here is SILENT.
 *
 * Next evaluates `rewrites()` once, at build time, and freezes the result into
 * `routes-manifest.json`. A missing `API_ORIGIN` does not throw - it
 * interpolates to the literal string "undefined", producing a destination of
 * `undefined/api/v1/...` that Next accepts and every API call then 404s
 * against. The app looks deployed. Nothing logs an error. Same shape as the
 * `metadataBase` trap already in CLAUDE.md.
 */
describe('apiProxyRewrites', () => {
  it('proxies the versioned prefix to the API origin', () => {
    const rewrites = apiProxyRewrites({
      API_ORIGIN: 'https://api.example.com',
      NEXT_PUBLIC_API_URL: '',
    });

    expect(rewrites).toEqual([
      { source: '/api/v1/:path*', destination: 'https://api.example.com/api/v1/:path*' },
    ]);
  });

  it('keeps the wildcard segment on both sides', () => {
    // Dropping `:path*` from the destination is the other silent failure: Next
    // accepts it and every request collapses onto the prefix itself, so
    // /auth/login and /metrics/overview both arrive at /api/v1.
    const [rewrite] = apiProxyRewrites({
      API_ORIGIN: 'https://api.example.com',
      NEXT_PUBLIC_API_URL: '',
    });
    expect(rewrite?.source).toContain(':path*');
    expect(rewrite?.destination).toContain(':path*');
  });

  it('never emits the string "undefined" in a destination', () => {
    for (const origin of ['https://api.example.com', 'https://api.example.com/']) {
      const [rewrite] = apiProxyRewrites({ API_ORIGIN: origin, NEXT_PUBLIC_API_URL: '' });
      expect(rewrite?.destination).not.toContain('undefined');
    }
  });

  it('normalises a trailing slash rather than doubling it', () => {
    // `https://api.example.com//api/v1/...` resolves on some proxies and 404s
    // on others, which makes it a environment-dependent bug rather than a
    // build-time one.
    const [rewrite] = apiProxyRewrites({
      API_ORIGIN: 'https://api.example.com/',
      NEXT_PUBLIC_API_URL: '',
    });
    expect(rewrite?.destination).toBe('https://api.example.com/api/v1/:path*');
  });

  it('adds no rewrite when the client is pointed at an absolute API URL', () => {
    // Local development: the browser talks to http://localhost:8000 directly.
    // That is same-SITE with localhost:3000 (ports do not affect site), so the
    // SameSite=Lax refresh cookie works without a proxy and adding one would
    // only obscure where requests go.
    expect(
      apiProxyRewrites({ API_ORIGIN: undefined, NEXT_PUBLIC_API_URL: 'http://localhost:8000' }),
    ).toEqual([]);
  });

  it('adds no rewrite when neither variable is set', () => {
    // The default clone with no .env. client.ts falls back to
    // http://localhost:8000 through `??`, which only fires on undefined - so an
    // UNSET variable means "call localhost directly" and an EMPTY one means
    // "use the proxy". Collapsing the two makes `pnpm build` throw on a fresh
    // checkout, which is how this was caught.
    expect(apiProxyRewrites({ API_ORIGIN: undefined, NEXT_PUBLIC_API_URL: undefined })).toEqual([]);
  });

  it('throws when the client expects a proxy that is not configured', () => {
    // NEXT_PUBLIC_API_URL='' means client.ts emits relative /api/v1/... URLs.
    // With no API_ORIGIN there is nothing to serve them, so the whole
    // authenticated surface 404s. Failing the BUILD is the only place this is
    // cheap to notice.
    expect(() => apiProxyRewrites({ API_ORIGIN: undefined, NEXT_PUBLIC_API_URL: '' })).toThrow(
      /API_ORIGIN/,
    );
  });

  it('rejects an origin that is not an absolute URL', () => {
    // A bare hostname pasted from the Northflank dashboard is the likely
    // mistake, and it produces `api.example.com/api/v1/...` - read by Next as a
    // relative path, so the rewrite silently points the app at itself.
    expect(() =>
      apiProxyRewrites({ API_ORIGIN: 'api.example.com', NEXT_PUBLIC_API_URL: '' }),
    ).toThrow(/absolute/i);
  });

  it('rejects an origin carrying a path, which would be dropped', () => {
    expect(() =>
      apiProxyRewrites({ API_ORIGIN: 'https://api.example.com/v1', NEXT_PUBLIC_API_URL: '' }),
    ).toThrow(/path/i);
  });

  it('exports a source built from the client versioned prefix', () => {
    // The rewrite and the fetch layer must agree. If client.ts moves to
    // /api/v2 and this does not, every call 404s - so the prefix has one
    // definition and this asserts the rewrite is built from it.
    expect(API_PROXY_SOURCE).toBe('/api/v1/:path*');
  });
});
