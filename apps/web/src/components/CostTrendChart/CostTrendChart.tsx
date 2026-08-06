'use client';

import { useMemo } from 'react';

import {
  baseOption,
  categoryAxis,
  niceBounds,
  seriesTooltip,
  strong,
  tooltipHtml,
  useChartTokens,
  useReducedMotion,
  valueAxis,
  type EChartsOption,
} from '@beff/ui/chart';
import { ChartFigure } from '@beff/ui/chart-figure';
import { DataTable, type DataColumn } from '@beff/ui/data-table';
import { EChart } from '@beff/ui/echart';

import { CSV_NAMES, FIGURE_IDS } from '@/constants/figures';
import { formatters } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';

import type { Formatters } from '@/lib/format';
import type { TrendPoint } from '@beff/api-client/types';

/** One batch, with the running total it took the window to. */
export interface CumulativePoint {
  point: TrendPoint;
  cumulativeEur: number;
}

/** The copy this chart's tooltip needs, so the builder can be tested alone. */
export interface CostTrendTooltipCopy {
  seriesName: string;
  batchLoss: string;
}

/**
 * The running total, batch by batch.
 *
 * A cumulative series is only honest if it starts where the window starts, so
 * this is derived in one place and used by the line, the tooltip and the table
 * rather than recomputed per view.
 */
export function cumulative(points: readonly TrendPoint[]): CumulativePoint[] {
  let running = 0;
  return points.map((point) => {
    running += point.committed_value_lost_eur;
    return { point, cumulativeEur: running };
  });
}

export function costTrendTooltip(
  entry: CumulativePoint,
  format: Formatters,
  copy: CostTrendTooltipCopy,
): string {
  return tooltipHtml([
    strong(entry.point.batch_code),
    format.fullDate(entry.point.started_at),
    `${copy.batchLoss}: ${format.euro(entry.point.committed_value_lost_eur)}`,
    `${copy.seriesName}: ${format.euro(entry.cumulativeEur)}`,
  ]);
}

/**
 * What the window has cost so far, as it accumulated.
 *
 * ## Why cumulative rather than per batch
 *
 * The per-batch figure is already legible from the yield trend - a bad batch is
 * a dip, and the euros track it. What no other chart on the page shows is the
 * *total*, and the total is the number the conversation upstairs is actually
 * about. `KpiRow` states it as a single figure; this says how the line got
 * there, which is the difference between "we lost €47 200 this month" and "we
 * lost €47 200 and two thirds of it happened in the last week".
 *
 * A rising cumulative line is not news - it can only rise. Its **slope** is the
 * news, and a steepening curve is a process getting worse in a way a monthly
 * total cannot show and a noisy per-batch bar chart buries.
 *
 * ## Why one axis and no second series
 *
 * The obvious addition is per-batch euros as bars behind the curve. That needs
 * a second y-axis, and two scales on one plot is the most reliable way to make
 * a chart lie: the crossing point is an artefact of the axis ranges and readers
 * read it as meaning something. The per-batch figure is in the tooltip and in
 * the table, where it cannot be misread as a relationship.
 *
 * ## The colour is not the yield colour
 *
 * `series-2`, the same hue `ScrapCostChart` uses. Money is one measure across
 * this dashboard and it wears one colour; yield is another and wears another.
 */
export function CostTrendChart({
  points,
  locale,
}: {
  points: readonly TrendPoint[];
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const copy = t.dashboard.charts.costTrend;
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const format = useMemo(() => formatters(locale), [locale]);

  const entries = useMemo(() => cumulative(points), [points]);

  const columns = useMemo<DataColumn<CumulativePoint>[]>(
    () => [
      {
        key: 'batch',
        header: copy.columnBatch,
        rowHeader: true,
        render: (entry) => entry.point.batch_code,
        text: (entry) => entry.point.batch_code,
        sortValue: (entry) => entry.point.batch_code,
      },
      {
        key: 'started',
        header: copy.columnDate,
        render: (entry) => format.fullDate(entry.point.started_at),
        text: (entry) => format.fullDate(entry.point.started_at),
        sortValue: (entry) => entry.point.started_at,
        filterDate: (entry) => entry.point.started_at,
      },
      {
        key: 'lost',
        header: copy.columnLost,
        align: 'end',
        render: (entry) => format.euro(entry.point.committed_value_lost_eur),
        text: (entry) => format.euro(entry.point.committed_value_lost_eur),
        sortValue: (entry) => entry.point.committed_value_lost_eur,
        filterRange: (entry) => entry.point.committed_value_lost_eur,
      },
      {
        key: 'cumulative',
        header: copy.columnCumulative,
        align: 'end',
        render: (entry) => format.euro(entry.cumulativeEur),
        text: (entry) => format.euro(entry.cumulativeEur),
        // Sortable, and sorting it is meaningless on purpose-built data - the
        // running total only ever ascends in batch order. Left sortable anyway
        // because a column that refuses to sort is a column that looks broken.
        sortValue: (entry) => entry.cumulativeEur,
      },
    ],
    [copy, format],
  );

  const option = useMemo<EChartsOption>(() => {
    const base = baseOption({ tokens, reducedMotion });
    const totals = entries.map((entry) => entry.cumulativeEur);

    return {
      ...base,
      xAxis: categoryAxis(tokens, {
        data: entries.map((entry) => format.axisDate(entry.point.started_at)),
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          interval: 'auto' as const,
          hideOverlap: true,
        },
      }),
      yAxis: valueAxis(tokens, {
        // Anchored at zero, always. A cumulative total on a truncated axis
        // exaggerates its own slope, which is the one thing this chart is read
        // for - `clampMin` makes that structural rather than a habit.
        ...niceBounds([0, ...totals], { padRatio: 0.1, clampMin: 0 }),
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          formatter: (value: number) => format.euro(value),
        },
      }),
      series: [
        {
          type: 'line',
          name: copy.seriesName,
          data: totals,
          lineStyle: { width: 2, color: tokens['color-chart-series-2'] },
          itemStyle: { color: tokens['color-chart-series-2'] },
          // A translucent fill, because the area under a cumulative curve is
          // the quantity itself rather than decoration. Faint enough that the
          // gridlines still read through it.
          areaStyle: { color: tokens['color-chart-series-2'], opacity: 0.12 },
          showSymbol: false,
          symbolSize: 8,
          smooth: false,
        },
      ],
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { color: tokens['color-border-default'], width: 1, type: 'solid' },
        },
        formatter: seriesTooltip(entries, (entry) => costTrendTooltip(entry, format, copy)),
      },
    };
  }, [entries, tokens, reducedMotion, format, copy]);

  return (
    <ChartFigure
      id={FIGURE_IDS.costTrend}
      title={copy.title}
      description={copy.description}
      viewChartLabel={t.dashboard.table.viewChart}
      viewTableLabel={t.dashboard.table.viewTable}
      chart={<EChart option={option} height="20rem" />}
      table={
        <DataTable
          caption={copy.tableCaption}
          columns={columns}
          rows={entries}
          rowKey={(entry) => entry.point.batch_code}
          locale={locale}
          csvName={CSV_NAMES.costTrend}
          copy={t.dashboard.table}
        />
      }
    />
  );
}
