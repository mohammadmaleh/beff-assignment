/**
 * The production API proxy.
 *
 * In production the web app and the API are on different hosts — Vercel and
 * Northflank — and both sit under public suffixes, so they share no registrable
 * domain and are **cross-site** to a browser. The refresh cookie is
 * `SameSite=Lax` on purpose (see `auth/router/cookies.py`), which means on a
 * cross-site split the browser would neither store nor send it: login would
 * appear to succeed and the session would die at the first refresh, with
 * nothing in the API logs to show for it.
 *
 * So the browser only ever talks to the web origin, and Next forwards the
 * versioned prefix onward. One origin, `SameSite=Lax` intact, and CORS stops
 * being involved at all.
 *
 * Locally there is nothing to do: `localhost:3000` and `localhost:8000` differ
 * only by port, and ports do not affect *site*, so the cookie already works.
 */
import { API_PREFIX } from '../api/client';

export interface Rewrite {
  source: string;
  destination: string;
}

/** Environment this depends on, passed in so it can be tested without mutating `process.env`. */
export interface RewriteEnv {
  /** Absolute origin of the deployed API. Server-side only — never `NEXT_PUBLIC_`. */
  API_ORIGIN?: string | undefined;
  /** Empty string means "use the proxy"; an absolute URL means "call the API directly". */
  NEXT_PUBLIC_API_URL?: string | undefined;
}

export const API_PROXY_SOURCE = `${API_PREFIX}/:path*`;

/**
 * Build the rewrite list for `next.config.ts`.
 *
 * Throws rather than returning something plausible. Next calls this once at
 * build time and freezes the result into `routes-manifest.json`, so a bad value
 * is not a runtime error anyone will see — it is a deployed app where every API
 * call 404s against a URL that looks almost right. The build is the only cheap
 * place to notice.
 */
export function apiProxyRewrites(env: RewriteEnv): Rewrite[] {
  const origin = env.API_ORIGIN?.trim();

  if (!origin) {
    // Unset and empty are DIFFERENT here, and the difference is load-bearing.
    // `client.ts` reads `NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'`, and
    // `??` only fires on null/undefined — so an unset variable yields an
    // absolute localhost URL (call the API directly, no proxy), while an
    // explicitly empty one yields relative URLs (proxy required). Treating both
    // as falsy makes `pnpm build` throw on a fresh clone with no .env.
    if (env.NEXT_PUBLIC_API_URL !== '') return [];

    throw new Error(
      'NEXT_PUBLIC_API_URL is empty, so the client emits relative /api/v1 URLs, ' +
        'but API_ORIGIN is not set so there is nothing to proxy them to. ' +
        'Set API_ORIGIN to the absolute origin of the deployed API.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    // A bare hostname copied from a dashboard is the likely mistake. Next would
    // read it as a relative path and point the app at itself.
    throw new Error(`API_ORIGIN must be an absolute URL including the scheme, got "${origin}".`);
  }

  if (parsed.pathname !== '/') {
    // Silently dropped otherwise, because the destination is rebuilt from the
    // origin. Better to say so than to serve a subtly wrong upstream.
    throw new Error(
      `API_ORIGIN must be an origin with no path, got "${origin}" (path "${parsed.pathname}").`,
    );
  }

  return [{ source: API_PROXY_SOURCE, destination: `${parsed.origin}${API_PROXY_SOURCE}` }];
}
