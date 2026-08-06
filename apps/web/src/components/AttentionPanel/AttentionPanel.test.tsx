import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { formatters } from '@/lib/format';

import { AttentionPanel, findings, findingTone, reading } from './AttentionPanel';

import type { MetricsOverview, MetricsTrend } from '@/lib/metrics';

const OVERVIEW: MetricsOverview = {
  line_name: 'Pilotlinie 1',
  line_kind: 'pilot',
  window_days: 30,
  first_pass_yield_pct: 71.68,
  first_pass_yield_delta_pp: 5.35,
  scrap_rate_pct: 27.84,
  scrap_rate_delta_pp: -5.3,
  capacity_retention_pct: 88.32,
  co2_intensity_kg_per_kwh: 63.86,
  scrap_by_step: [
    { process_step: 'coating', scrap_rate_pct: 6.43, committed_value_eur: 7517 },
    { process_step: 'formation', scrap_rate_pct: 5.36, committed_value_eur: 27_247 },
  ],
  spec_bands: [
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

const TREND: MetricsTrend = {
  line_name: 'Pilotlinie 1',
  line_kind: 'pilot',
  window_days: 30,
  total_cells_started: 2400,
  total_cells_passed: 1721,
  total_cells_scrapped: 679,
  total_committed_value_lost_eur: 34_764,
  window_first_pass_yield_pct: 71.71,
  best_batch_code: 'B-2026-002',
  worst_batch_code: 'B-2026-001',
  benchmark: {
    line_kind: 'pilot',
    sample_size: 34,
    first_pass_yield_p50_pct: 68,
    first_pass_yield_p90_pct: 77.5,
    scrap_rate_p50_pct: 32,
    co2_intensity_p50_kg_per_kwh: 64,
  },
  points: [],
  parameters: [],
};

const kinds = (overview: MetricsOverview, trend?: MetricsTrend): string[] =>
  findings(overview, trend).map((finding) => finding.kind);

describe('findings', () => {
  it('says nothing is wrong rather than showing an empty list', () => {
    // An empty panel is indistinguishable from one that failed to load, and the
    // reader cannot tell "all clear" from "broken" by looking at nothing.
    expect(kinds(OVERVIEW, TREND)).toEqual(['clear', 'cost']);
  });

  it('reports a parameter outside its window', () => {
    const out = {
      ...OVERVIEW,
      spec_bands: [{ ...OVERVIEW.spec_bands[0]!, value: 36.8 }],
    };

    expect(kinds(out, TREND)).toContain('parameter');
    expect(kinds(out, TREND)).not.toContain('clear');
  });

  it('judges yield against the window for the kind of line it is', () => {
    // 71.7% is comfortable on a pilot line and a crisis on a production one.
    // The same number, two verdicts - the product's whole thesis, applied here.
    expect(kinds(OVERVIEW, TREND)).not.toContain('yield');
    expect(kinds({ ...OVERVIEW, line_kind: 'production' }, TREND)).toContain('yield');
  });

  it('separates being out of spec from being behind the cohort', () => {
    // Below the median of comparable lines is an opportunity, not a fault.
    // Conflating the two trains people to ignore both.
    const behind = {
      ...TREND,
      benchmark: { ...TREND.benchmark, first_pass_yield_p50_pct: 80 },
    };

    expect(kinds(OVERVIEW, behind)).toContain('cohort');
    expect(findingTone({ kind: 'cohort', gapPp: -8.3 })).toBe('warning');
    expect(findingTone({ kind: 'yield', value: 30, lower: 40, upper: 80 })).toBe('danger');
  });

  it('names the most expensive step, not the one that scrapped the most cells', () => {
    // Coating scraps more cells; formation loses more money, because a cell
    // scrapped there has absorbed every upstream cost.
    const cost = findings(OVERVIEW, TREND).find((finding) => finding.kind === 'cost');

    expect(cost).toEqual({ kind: 'cost', step: 'formation', eur: 27_247 });
  });

  it('never reorders the caller’s own breakdown', () => {
    // The scrap charts below depend on process order for their meaning. A sort
    // in here would reach them through the shared array.
    const rows = [...OVERVIEW.scrap_by_step];
    findings(OVERVIEW, TREND);

    expect(OVERVIEW.scrap_by_step).toEqual(rows);
  });

  it('works before the trend query has landed', () => {
    // Two queries, two arrival times. The panel must not wait on the slower one
    // to say that a parameter is out of spec.
    expect(kinds(OVERVIEW, undefined)).toEqual(['clear', 'cost']);
  });

  it('has nothing to say about a line with no breakdown yet', () => {
    expect(kinds({ ...OVERVIEW, scrap_by_step: [] }, TREND)).toEqual(['clear']);
  });
});

describe('reading', () => {
  it('formats a percentage rather than gluing a sign onto a number', () => {
    // German puts a non-breaking space before `%`. A template literal produces
    // either `32,4%` or a sign that can wrap alone onto the next line.
    expect(reading(32.4, '%', formatters('de'))).toBe('32,4\u00A0%');
  });

  it('keeps an ordinary space for units the formatter has no notion of', () => {
    expect(reading(248.2, 'Wh/kg', formatters('en'))).toBe('248.2 Wh/kg');
  });
});

describe('AttentionPanel', () => {
  it('states the verdict in a word, never in a colour alone', () => {
    const out = {
      ...OVERVIEW,
      spec_bands: [{ ...OVERVIEW.spec_bands[0]!, value: 36.8 }],
    };
    render(<AttentionPanel overview={out} trend={TREND} locale="en" />);

    const panel = screen.getByRole('region', { name: 'Needs attention' });
    expect(within(panel).getByText('Out of spec')).toBeInTheDocument();
  });

  it('says which way round the cohort gap is, once', () => {
    // The sentence already says "below"; a negative sign in front of it says it
    // a second time, in the opposite direction.
    render(
      <AttentionPanel
        overview={OVERVIEW}
        trend={{ ...TREND, benchmark: { ...TREND.benchmark, first_pass_yield_p50_pct: 80 } }}
        locale="en"
      />,
    );

    expect(screen.getByText(/is \+8\.3 pp below the median/)).toBeInTheDocument();
  });

  it('names the parameter and the step in German', () => {
    const out = {
      ...OVERVIEW,
      spec_bands: [{ ...OVERVIEW.spec_bands[0]!, value: 36.8 }],
    };
    render(<AttentionPanel overview={out} trend={TREND} locale="de" />);

    expect(screen.getByText(/Elektrodenporosität/)).toBeInTheDocument();
    expect(screen.getByText(/Formierung/)).toBeInTheDocument();
  });
});
