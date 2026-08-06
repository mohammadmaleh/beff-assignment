'use client';

import { Reading, ReadingList } from '@beff/ui/reading';

import { useMemo } from 'react';

import { formatters } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';

import type { MetricsTrend } from '@beff/api-client/types';

/**
 * Four readings that are facts about the window rather than measurements of the
 * process.
 *
 * ## Why these are `Reading` and not `Metric` or `SpecBand`
 *
 * `SpecBand` is for a measurement against a limit, and `Metric` is for a
 * measurement with a direction of travel. None of these four is either. "€47 200
 * of committed value lost" has no specification window and no meaningful
 * previous-period arrow - it scales with how much the line ran. Dressing it in
 * a band would be the exact mistake the dashboard's own comment warns about:
 * consistent-looking, and a lie about the reading.
 *
 * So they are stated plainly, as a figure and a sentence that says what it is -
 * which is `Reading`, the library's third numeric primitive. It lived here as
 * hand-written markup until this argument made the case that the gap was in the
 * design system rather than in this file.
 *
 * What stays here is the domain: which four readings, the benchmark
 * arithmetic, and the copy. What left is how a stated figure looks.
 *
 * ## The benchmark tile
 *
 * This is the one that reflects what Beff actually sells. The Virtual Factory
 * Platform's proposition is a proprietary database of comparable lines, and the
 * question it answers is not "am I in spec" but "am I good" - a pilot line at
 * 71.8% is comfortably inside its 40-80% window and still below the median of
 * its peer group, and those two facts lead to different decisions.
 *
 * The tile states the sample size in its own sentence. A benchmark rendered
 * without its n reads as a measurement of something; with it, it reads as what
 * it is - a reference. See `benchmark/cohort.py` for why the figures are
 * constants at pre-launch and what has to change for them not to be.
 */
export function KpiRow({ trend, locale }: { trend: MetricsTrend; locale: Locale }) {
  const t = getDictionary(locale);
  const copy = t.dashboard.kpi;
  const format = useMemo(() => formatters(locale), [locale]);

  const versusCohort = trend.window_first_pass_yield_pct - trend.benchmark.first_pass_yield_p50_pct;

  const tiles = [
    {
      key: 'cost',
      label: copy.costLabel,
      value: format.euro(trend.total_committed_value_lost_eur),
      note: copy.costNote,
    },
    {
      key: 'cells',
      label: copy.cellsLabel,
      value: format.count(trend.total_cells_passed),
      note: copy.cellsNote.replace('{started}', format.count(trend.total_cells_started)),
    },
    {
      key: 'benchmark',
      label: copy.benchmarkLabel,
      value: format.percentagePoints(versusCohort),
      note: copy.benchmarkNote
        .replace('{n}', format.count(trend.benchmark.sample_size))
        .replace('{median}', format.percent(trend.benchmark.first_pass_yield_p50_pct)),
    },
    {
      key: 'worst',
      label: copy.worstLabel,
      // `??` rather than `||` - an empty window returns null, and the em dash
      // is a deliberate "nothing to show" rather than a blank cell that reads
      // as a rendering failure.
      value: trend.worst_batch_code ?? '-',
      note: copy.worstNote.replace('{count}', format.count(trend.points.length)),
    },
  ];

  return (
    <ReadingList className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      {tiles.map((tile) => (
        <Reading key={tile.key} label={tile.label} value={tile.value} note={tile.note} />
      ))}
    </ReadingList>
  );
}
