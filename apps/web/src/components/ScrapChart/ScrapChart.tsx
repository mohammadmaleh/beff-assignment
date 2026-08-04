'use client';

import { useMemo } from 'react';

import { ChartFigure } from '@/components/ChartFigure';
import { DataTable, type DataColumn } from '@/components/DataTable';
import { chartFormatters } from '@/lib/chart';
import { getDictionary, type Locale } from '@/lib/i18n';

export interface ScrapRow {
  process_step: string;
  scrap_rate_pct: number;
  committed_value_eur: number;
}

/**
 * ## Scrap by process step
 *
 * ### Why the table is the real thing
 *
 * The bars are `aria-hidden`. The `<table>` beside them is not an "alternative"
 * bolted on for compliance — it is the authoritative rendering, and the chart
 * is a fast visual index into it. That inversion is deliberate: a chart built
 * accessible-first cannot drift out of sync with its own description, because
 * there is only one source of numbers.
 *
 * This component set that rule and was then the one chart never moved onto
 * `ChartFigure`. It carried its own `<details>` disclosure, its own table markup
 * and its own `Intl.NumberFormat` instances — which is exactly how it came to
 * render `7,8%` in German, where the space before the sign is mandatory and
 * non-breaking. It now uses `chartFormatters` like the other four, and the bars
 * and the table read the same string from the same formatter.
 *
 * ### Why there is no colour scale
 *
 * Every bar is one neutral. Colouring by severity would mean encoding a
 * quantity in hue, which fails for roughly one man in twelve, and `success` /
 * `warning` / `danger` are reserved for *in spec* versus *out of spec* — using
 * them for "more scrap" would make the palette mean two different things in one
 * screen. Magnitude is carried by bar length and by the number printed at the
 * end of every bar, which is legible in greyscale and to a screen reader.
 *
 * ### Ordering
 *
 * Process order, never sorted by size, because a cell lost at formation has
 * absorbed every upstream cost and the position of a bar carries economic
 * meaning that re-sorting would destroy. The table *offers* sorting — that is
 * the reader choosing to ask a different question, which is not the same thing
 * as the component answering the first one wrongly.
 */
export function ScrapChart({
  rows,
  locale,
  order,
}: {
  rows: readonly ScrapRow[];
  locale: Locale;
  /** Canonical process order, from CONTEXT.md. */
  order: readonly string[];
}) {
  const t = getDictionary(locale);
  const steps = t.dashboard.steps as Record<string, string>;
  const format = useMemo(() => chartFormatters(locale), [locale]);

  const ordered = useMemo(
    () => [...rows].sort((a, b) => order.indexOf(a.process_step) - order.indexOf(b.process_step)),
    [rows, order],
  );

  // At least 1, so a line with no scrap at all divides by one rather than by
  // negative infinity and draws empty bars instead of `NaN%` widths.
  const worst = Math.max(...ordered.map((row) => row.scrap_rate_pct), 1);

  const columns = useMemo<DataColumn<ScrapRow>[]>(
    () => [
      {
        key: 'step',
        header: t.dashboard.columnStep,
        rowHeader: true,
        render: (row) => steps[row.process_step] ?? row.process_step,
        text: (row) => steps[row.process_step] ?? row.process_step,
        sortValue: (row) => steps[row.process_step] ?? row.process_step,
      },
      {
        key: 'scrap',
        header: t.dashboard.columnScrap,
        align: 'end',
        render: (row) => format.percent(row.scrap_rate_pct),
        text: (row) => format.percent(row.scrap_rate_pct),
        sortValue: (row) => row.scrap_rate_pct,
        filterRange: (row) => row.scrap_rate_pct,
      },
      {
        key: 'cost',
        header: t.dashboard.columnCost,
        align: 'end',
        render: (row) => format.euro(row.committed_value_eur),
        text: (row) => format.euro(row.committed_value_eur),
        sortValue: (row) => row.committed_value_eur,
      },
    ],
    [t, steps, format],
  );

  return (
    <ChartFigure
      id="scrap-by-step"
      title={t.dashboard.scrapChartTitle}
      description={t.dashboard.scrapChartDescription}
      viewChartLabel={t.dashboard.table.viewChart}
      viewTableLabel={t.dashboard.table.viewTable}
      chart={
        <ul aria-hidden="true" className="flex flex-col gap-2">
          {ordered.map((row) => (
            <li
              key={row.process_step}
              className="grid grid-cols-[10rem_1fr_4rem] items-center gap-3"
            >
              <span className="text-text-muted truncate text-[length:var(--type-ui-size-sm)]">
                {steps[row.process_step] ?? row.process_step}
              </span>
              <span className="bg-surface-sunken block h-4">
                <span
                  className="bg-chart-series-2 block h-4"
                  style={{ inlineSize: `${String((row.scrap_rate_pct / worst) * 100)}%` }}
                />
              </span>
              <span className="text-end text-[length:var(--type-ui-size-sm)] tabular-nums">
                {format.percent(row.scrap_rate_pct)}
              </span>
            </li>
          ))}
        </ul>
      }
      table={
        <DataTable
          caption={t.dashboard.scrapTableCaption}
          columns={columns}
          rows={ordered}
          rowKey={(row) => row.process_step}
          locale={locale}
          csvName="scrap-by-step"
          copy={t.dashboard.table}
        />
      }
    />
  );
}
