import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KpiRow } from './KpiRow';

import type { MetricsTrend } from '@beff/api-client/types';

function trend(overrides: Partial<MetricsTrend> = {}): MetricsTrend {
  return {
    line_name: 'Pilotlinie 1',
    line_kind: 'pilot',
    window_days: 30,
    total_cells_started: 34_000,
    total_cells_passed: 24_412,
    total_cells_scrapped: 9588,
    total_committed_value_lost_eur: 47_218.4,
    window_first_pass_yield_pct: 71.8,
    best_batch_code: 'B-2026-058',
    worst_batch_code: 'B-2026-041',
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
    ...overrides,
  };
}

describe('KpiRow', () => {
  it('renders as a description list, so each figure is bound to its label', () => {
    // Four numbers in `<div>`s are four numbers. A `<dl>` is what makes
    // "€47,218" and "Committed value lost" one thing to a screen reader.
    const { container } = render(<KpiRow trend={trend()} locale="en" />);

    expect(container.querySelector('dl')).not.toBeNull();
    expect(container.querySelectorAll('dt')).toHaveLength(4);
    expect(container.querySelectorAll('dd')).toHaveLength(4);
  });

  it('states the money the scrap cost', () => {
    render(<KpiRow trend={trend()} locale="en" />);

    expect(screen.getByText('€47,218')).toBeInTheDocument();
  });

  it('reports the benchmark gap in percentage points, signed', () => {
    // Never as a percentage change: "up 5%" from 68% is ambiguous between 71.4
    // and 73, and on a yield figure those are different weeks.
    render(<KpiRow trend={trend()} locale="en" />);

    expect(screen.getByText('+3.8 pp')).toBeInTheDocument();
  });

  it('shows a negative gap with its sign when the line is below the cohort', () => {
    render(<KpiRow trend={trend({ window_first_pass_yield_pct: 61.2 })} locale="en" />);

    expect(screen.getByText('-6.8 pp')).toBeInTheDocument();
  });

  it('says how many lines the benchmark is drawn from', () => {
    // A benchmark with no stated n reads as a measurement. It is a reference —
    // see `benchmark/cohort.py` for why, at pre-launch, it has to be.
    render(<KpiRow trend={trend()} locale="en" />);

    expect(screen.getByText(/Median of 34 pilot lines is 68\.0%/)).toBeInTheDocument();
  });

  it('names the worst batch, so the reading points somewhere', () => {
    // "Yield fell" without a batch code is a chart the reader has to trace with
    // a finger. A batch code is a thing to go and investigate.
    render(<KpiRow trend={trend()} locale="en" />);

    expect(screen.getByText('B-2026-041')).toBeInTheDocument();
  });

  it('shows an em dash rather than a blank when there are no batches', () => {
    // The API returns null for an empty window. Rendering `''` leaves a cell
    // that reads as a rendering failure rather than as "nothing to show".
    render(<KpiRow trend={trend({ worst_batch_code: null, points: [] })} locale="en" />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('reports cells passed against cells started', () => {
    render(<KpiRow trend={trend()} locale="en" />);

    expect(screen.getByText('24,412')).toBeInTheDocument();
    expect(screen.getByText(/of 34,000 started/)).toBeInTheDocument();
  });

  it('renders in German on the German locale', () => {
    render(<KpiRow trend={trend()} locale="de" />);

    expect(screen.getByText('Verlorene gebundene Wertschöpfung')).toBeInTheDocument();
    expect(screen.getByText('24.412')).toBeInTheDocument();
  });
});
