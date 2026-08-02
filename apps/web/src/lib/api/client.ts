/**
 * The API base URL.
 *
 * `NEXT_PUBLIC_` because the authenticated surface is client-rendered — the
 * browser talks to FastAPI directly, so the value has to reach the bundle.
 * Falls back to the compose default rather than throwing, so a fresh clone
 * serves the landing page without a `.env` file.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Every route the app calls lives under this prefix.
 *
 * It is in one constant because the version is the whole point of having one:
 * cutting over to `/api/v2` must be a single edit, not a search across every
 * `fetch` in the codebase. `/healthz` and `/readyz` deliberately sit outside it
 * — a load balancer probing liveness should not care what version the API is
 * on.
 *
 * Exported because the production Next rewrite proxies exactly this prefix
 * (`lib/rewrites`). If the two ever disagree, every authenticated call 404s —
 * so they read from one constant rather than repeating the string.
 */
export const API_PREFIX = '/api/v1';

export const apiUrl = (path: string): string => `${BASE}${API_PREFIX}${path}`;
