/**
 * The dashboard's data shapes, re-exported from the generated client.
 *
 * These used to be hand-written here, which meant the frontend could keep
 * compiling against a contract the backend had already changed. They now come
 * from the API's own OpenAPI document, and `@beff/api-client`'s drift check
 * fails the build if the two disagree (ENG-33).
 *
 * Percentages are 0–100, never 0–1, and the field names say so — the schema uses
 * the same convention, so the unit is unambiguous at every call site.
 */
export type {
  CohortReference,
  MetricsOverview,
  MetricsTrend,
  ParameterSeries,
  ScrapByStep,
  SpecBandReading,
  TrendPoint,
} from '@beff/api-client/types';
