import { COMMITTED_VALUE_EUR, type MetricsOverview } from '@/lib/metrics';

/** Cells started in the window the panel shows. Twenty a day on a pilot line. */
const CELLS_STARTED = 600;

/**
 * The demo line's figures, as the API returns them.
 *
 * Typed as `MetricsOverview` on purpose: the panel renders the dashboard's own
 * components, so if the API contract changes shape this fails to compile instead
 * of quietly showing a marketing page built on a payload the product no longer
 * sends. The type is generated from the OpenAPI document, so that check is real.
 *
 * The numbers are the seeded demo account's, not decoration - 71.7 per cent
 * first-pass yield on a pilot line sits inside the 40–80 per cent CONTEXT.md
 * gives for one, scrap concentrates at coating and formation the way it does on
 * a real line, and energy density is deliberately out of spec because a
 * dashboard where everything is fine does not demonstrate that it can show a
 * problem.
 */
export const DEMO_LINE: MetricsOverview = {
  line_name: 'Pilotlinie 1',
  line_kind: 'pilot',
  window_days: 30,
  first_pass_yield_pct: 71.7,
  first_pass_yield_delta_pp: 5.4,
  scrap_rate_pct: 27.8,
  scrap_rate_delta_pp: -5.3,
  capacity_retention_pct: 88.3,
  co2_intensity_kg_per_kwh: 63.9,
  scrap_by_step: (
    [
      ['mixing', 1.0],
      ['coating', 6.4],
      ['drying', 1.6],
      ['calendering', 2.9],
      ['slitting', 1.3],
      ['die_cutting', 1.0],
      ['stacking', 1.9],
      ['welding', 1.3],
      ['filling', 1.6],
      ['formation', 5.4],
      ['aging', 1.9],
      ['eol_test', 1.6],
    ] as const
  ).map(([step, rate]) => ({
    process_step: step,
    scrap_rate_pct: rate,
    // Cells lost at this step, times the value already in them. Stated rather
    // than tabulated so the one assumption is visible: this is what the euro
    // column means, and it is why coating leads on percentage while formation
    // leads on cost.
    committed_value_eur: Math.round((rate / 100) * CELLS_STARTED * COMMITTED_VALUE_EUR[step]),
  })),
  spec_bands: [
    {
      parameter: 'areal_loading_mg_cm2',
      value: 21.8,
      lower_limit: 18,
      upper_limit: 24,
      target: 21,
      unit: 'mg/cm²',
    },
    {
      parameter: 'energy_density_wh_kg',
      value: 238,
      lower_limit: 240,
      upper_limit: 265,
      target: 252,
      unit: 'Wh/kg',
    },
    {
      parameter: 'porosity_pct',
      value: 32.4,
      lower_limit: 30,
      upper_limit: 35,
      target: 32.5,
      unit: '%',
    },
  ],
};
