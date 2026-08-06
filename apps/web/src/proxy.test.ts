import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { config, proxy } from './proxy';

const request = (path: string, acceptLanguage?: string): NextRequest =>
  new NextRequest(new URL(path, 'https://beff.example'), {
    headers: acceptLanguage === undefined ? {} : { 'accept-language': acceptLanguage },
  });

const location = (path: string, acceptLanguage?: string): string | null =>
  proxy(request(path, acceptLanguage)).headers.get('location');

describe('locale proxy', () => {
  it('sends the bare root to the default locale', () => {
    expect(location('/')).toBe('https://beff.example/en');
  });

  it('leaves an already-localised path alone', () => {
    // Everything under /en and /de is statically generated; the proxy must
    // not put itself in front of a static page.
    expect(location('/de/datenschutz')).toBeNull();
    expect(location('/en')).toBeNull();
  });

  it('honours a German Accept-Language header', () => {
    expect(location('/', 'de-DE,de;q=0.9,en;q=0.8')).toBe('https://beff.example/de');
  });

  it('treats regional German as German', () => {
    expect(location('/', 'de-AT')).toBe('https://beff.example/de');
    expect(location('/', 'de-CH,fr;q=0.5')).toBe('https://beff.example/de');
  });

  it('respects q-values rather than header order', () => {
    expect(location('/', 'en;q=0.2,de;q=0.9')).toBe('https://beff.example/de');
  });

  it('falls back to the default for a language we do not ship', () => {
    expect(location('/', 'fr-FR,fr;q=0.9')).toBe('https://beff.example/en');
  });

  it('falls back to the default when the header is absent or malformed', () => {
    expect(location('/')).toBe('https://beff.example/en');
    expect(location('/', ';;;')).toBe('https://beff.example/en');
  });

  it('keeps the rest of the path when it redirects', () => {
    expect(location('/impressum', 'de')).toBe('https://beff.example/de/impressum');
  });

  it('redirects temporarily, not permanently', () => {
    // Which locale a visitor gets is a negotiation. A 308 would pin the first
    // answer in their browser cache forever, including after they change their
    // browser language.
    expect(proxy(request('/')).status).toBe(307);
  });
});

describe('matcher', () => {
  const matches = (path: string): boolean => {
    const [pattern] = config.matcher;
    return new RegExp(`^${pattern}$`).test(path);
  };

  it('does not intercept the API proxy prefix', () => {
    // This is the assertion that keeps production working, and it guards a
    // dependency that is invisible from either file alone.
    //
    // In production the browser calls /api/v1/* on THIS origin and a Next
    // rewrite forwards it to the API host (see lib/rewrites) - that is what
    // lets the SameSite=Lax refresh cookie survive a Vercel/Northflank split.
    // If `api` ever leaves the matcher below, the locale proxy would take
    // /api/v1/auth/refresh first and 307 it to /en/api/v1/auth/refresh, which
    // matches no route. Every authenticated call would 404 while the landing
    // page kept working perfectly.
    expect(matches('/api/v1/auth/refresh')).toBe(false);
    expect(matches('/api/v1/metrics/overview')).toBe(false);
  });

  it('still intercepts locale-less page paths', () => {
    // The exclusion above must not be so broad that it stops the proxy
    // doing its actual job.
    expect(matches('/impressum')).toBe(true);
    expect(matches('/')).toBe(true);
  });

  it('leaves Next internals and files with an extension alone', () => {
    expect(matches('/_next/static/chunk.js')).toBe(false);
    // Without the extension guard this would redirect to /en/favicon.ico.
    expect(matches('/favicon.ico')).toBe(false);
    expect(matches('/icon.svg')).toBe(false);
  });
});
