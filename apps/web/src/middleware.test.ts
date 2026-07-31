import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { middleware } from './middleware';

const request = (path: string, acceptLanguage?: string): NextRequest =>
  new NextRequest(new URL(path, 'https://beff.example'), {
    headers: acceptLanguage === undefined ? {} : { 'accept-language': acceptLanguage },
  });

const location = (path: string, acceptLanguage?: string): string | null =>
  middleware(request(path, acceptLanguage)).headers.get('location');

describe('locale middleware', () => {
  it('sends the bare root to the default locale', () => {
    expect(location('/')).toBe('https://beff.example/en');
  });

  it('leaves an already-localised path alone', () => {
    // Everything under /en and /de is statically generated; the middleware must
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
    expect(middleware(request('/')).status).toBe(307);
  });
});
