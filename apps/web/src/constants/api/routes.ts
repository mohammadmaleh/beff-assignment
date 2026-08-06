/**
 * Every API path the browser calls, relative to `API_PREFIX`.
 *
 * `lib/api/client` owns the origin and the version prefix; this owns the paths
 * under it. They are constants for the reason the prefix is: a path is a
 * contract with a FastAPI router, and a typo in one produces a 404 at runtime
 * on a screen that may not be the one under test. Named here, the compiler is
 * what notices a rename, and one file answers "what does the frontend actually
 * call" - which is also the list a reviewer checks against the OpenAPI
 * document.
 */

export const AUTH_ROUTES = {
  login: '/auth/login',
  logout: '/auth/logout',
  me: '/auth/me',
  refresh: '/auth/refresh',
  register: '/auth/register',
  /** Redeems the link from the confirmation email. Needs no session. */
  verifyEmail: '/auth/verify-email',
  /** Queues another confirmation email for the signed-in caller's own address. */
  resendVerification: '/auth/verify-email/resend',
} as const;

export const METRICS_ROUTES = {
  /** The headline readings and the scrap breakdown. Small, so it lands first. */
  overview: '/metrics/overview',
  /** Sixty batches and their parameter series. Fetched in parallel, never chained. */
  trend: '/metrics/trend',
} as const;

export const ONBOARDING_ROUTES = {
  progress: '/onboarding',
  complete: '/onboarding/complete',
} as const;

export const PRIVACY_ROUTES = {
  consent: '/privacy/consent',
  export: '/privacy/export',
  erasure: '/privacy/erasure',
} as const;

export const WAITLIST_ROUTE = '/waitlist';
