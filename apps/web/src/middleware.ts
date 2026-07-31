import { NextResponse, type NextRequest } from 'next/server';

import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from '@/lib/i18n';

/**
 * Sends a locale-less URL to a locale.
 *
 * Only `/` and paths with no locale prefix reach here — everything under
 * `/en` and `/de` is statically generated and served without touching this.
 * The redirect is 307 rather than 308: which locale a visitor gets is a
 * negotiation, and a permanently-cached redirect would pin the first answer in
 * their browser forever.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const [, first] = pathname.split('/');
  if (first !== undefined && isLocale(first)) return NextResponse.next();

  const target = negotiate(request.headers.get('accept-language'));
  const url = request.nextUrl.clone();
  url.pathname = `/${target}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url, 307);
}

/**
 * Pick a locale from `Accept-Language`.
 *
 * Deliberately small: with two locales, a full RFC 4647 lookup with q-value
 * sorting buys nothing over "does the header mention German before English".
 */
function negotiate(header: string | null): Locale {
  if (header === null) return DEFAULT_LOCALE;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='))?.split('=')[1];
      return { tag: tag.toLowerCase(), q: q === undefined ? 1 : Number.parseFloat(q) };
    })
    .filter((entry) => !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    // `de-AT` and `de-CH` are German speakers too.
    const base = tag.split('-')[0] ?? '';
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return DEFAULT_LOCALE;
}

export const config = {
  /**
   * Everything except Next's own internals, the metadata files and anything
   * with a file extension. Without the extension guard, `/favicon.ico` would
   * redirect to `/en/favicon.ico` and 404.
   */
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
