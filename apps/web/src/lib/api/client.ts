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
 */
const PREFIX = '/api/v1';

export const apiUrl = (path: string): string => `${BASE}${PREFIX}${path}`;
