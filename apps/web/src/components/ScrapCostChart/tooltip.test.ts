import { describe, expect, it } from 'vitest';

import { formatters } from '@/lib/format';

import { scrapCostTooltip } from './ScrapCostChart';

import type { ScrapByStep } from '@beff/api-client/types';

const row: ScrapByStep = {
  process_step: 'formation',
  scrap_rate_pct: 5.36,
  committed_value_eur: 27_247,
};

const steps = { formation: 'Formation' };
const copy = { seriesName: 'Committed value lost', columnScrap: 'Scrap rate' };

describe('scrapCostTooltip', () => {
  it('shows the cost and the rate together', () => {
    // The whole reason this chart sits beside `ScrapChart`: coating leads on
    // rate, formation leads on cost, and a reader has to be able to see both
    // for one step without switching tables.
    const html = scrapCostTooltip(row, steps, formatters('en'), copy);

    expect(html).toContain('Committed value lost: €27,247');
    expect(html).toContain('Scrap rate: 5.4%');
  });

  it('names the step in the reader’s language', () => {
    expect(scrapCostTooltip(row, { formation: 'Formierung' }, formatters('de'), copy)).toContain(
      '<strong>Formierung</strong>',
    );
  });

  it('falls back to the raw key for a step the frontend has not been taught', () => {
    // A new backend step must show as an unfamiliar name, not as `undefined`.
    const html = scrapCostTooltip(
      { ...row, process_step: 'laser_notching' },
      steps,
      formatters('en'),
      copy,
    );

    expect(html).toContain('<strong>laser_notching</strong>');
  });

  it('prices in whole euros', () => {
    expect(scrapCostTooltip(row, steps, formatters('en'), copy)).not.toContain('.00');
  });
});
