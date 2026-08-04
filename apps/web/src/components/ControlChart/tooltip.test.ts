import { describe, expect, it } from 'vitest';

import { chartFormatters } from '@/lib/chart';

import { breaches, controlTooltip } from './ControlChart';

import type { ParameterSeries } from '@beff/api-client/types';

const series: ParameterSeries = {
  parameter: 'energy_density_wh_kg',
  unit: 'Wh/kg',
  lower_limit: 240,
  upper_limit: 265,
  target: 252,
  points: [],
};

const copy = { inSpec: 'In spec', outOfSpec: 'Out of spec' };

describe('breaches', () => {
  it('is false inside the window', () => {
    expect(breaches(251, series)).toBe(false);
  });

  it('is true below the lower limit', () => {
    expect(breaches(238, series)).toBe(true);
  });

  it('is true above the upper limit', () => {
    // Both directions. A check written against one example catches one side.
    expect(breaches(271, series)).toBe(true);
  });

  it('treats both limits as inclusive', () => {
    // A reading *at* 240.0 has not breached 240.0. An off-by-one here reports a
    // conforming batch as a failure, and this is the single definition the
    // drawing, the description and the table all read.
    expect(breaches(240, series)).toBe(false);
    expect(breaches(265, series)).toBe(false);
  });
});

describe('controlTooltip', () => {
  const point = { started_at: '2026-07-31T06:00:00Z', value: 238 };

  it('states the verdict as a word, not only as a marker colour', () => {
    expect(controlTooltip(point, series, chartFormatters('en'), copy)).toContain('Out of spec');
  });

  it('says so when the reading conforms', () => {
    expect(controlTooltip({ ...point, value: 251 }, series, chartFormatters('en'), copy)).toContain(
      'In spec',
    );
  });

  it('shows the value with its unit', () => {
    expect(controlTooltip(point, series, chartFormatters('en'), copy)).toContain(
      '<strong>238.0 Wh/kg</strong>',
    );
  });

  it('gives the date in full', () => {
    expect(controlTooltip(point, series, chartFormatters('en'), copy)).toContain('2026');
  });

  it('renders the verdict in the reader’s language', () => {
    expect(
      controlTooltip(point, series, chartFormatters('de'), {
        inSpec: 'In Spezifikation',
        outOfSpec: 'Außerhalb der Spezifikation',
      }),
    ).toContain('Außerhalb der Spezifikation');
  });
});
