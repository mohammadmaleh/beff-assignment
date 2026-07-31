/**
 * The shape of `GET /metrics/overview`.
 *
 * Percentages are 0–100, never 0–1, and the field name says so — the schema
 * uses the same convention so the unit is unambiguous at every call site.
 */
export interface ScrapByStep {
  process_step: string;
  scrap_rate_pct: number;
  /** Value already committed to a cell by the time it is lost at this step. */
  committed_value_eur: number;
}

export interface SpecBandReading {
  parameter: string;
  label: string;
  value: number;
  lower_limit: number;
  upper_limit: number;
  target: number | null;
  unit: string;
}

export interface MetricsOverview {
  line_name: string;
  /** `pilot` or `production` — a pilot line running 60% yield is normal. */
  line_kind: string;
  window_days: number;
  first_pass_yield_pct: number;
  first_pass_yield_delta_pp: number;
  scrap_rate_pct: number;
  scrap_rate_delta_pp: number;
  capacity_retention_pct: number;
  co2_intensity_kg_per_kwh: number;
  scrap_by_step: readonly ScrapByStep[];
  spec_bands: readonly SpecBandReading[];
}
