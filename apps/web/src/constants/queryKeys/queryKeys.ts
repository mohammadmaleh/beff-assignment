/**
 * React Query cache keys.
 *
 * A cache key is a *join*, not a label: `useQuery` writes under it and
 * `setQueryData` reads back through it, and the two are in different files. Two
 * literals that must match and cannot be checked against each other is the
 * shape of a bug that shows up as "the screen did not update after saving" -
 * no error, no failed request, just a mutation writing into a key nothing is
 * subscribed to. That has to be one constant or it is not one key.
 *
 * `as const` matters here beyond tidiness: React Query hashes the key
 * structurally, so a mutable `string[]` and a readonly tuple hash the same, but
 * the literal types are what stop `QUERY_KEYS.consent` being reassigned to
 * something a caller elsewhere still expects.
 */
export const QUERY_KEYS = {
  metricsOverview: ['metrics', 'overview'],
  metricsTrend: ['metrics', 'trend'],
  onboarding: ['onboarding'],
  consent: ['consent'],
  export: ['export'],
} as const;
