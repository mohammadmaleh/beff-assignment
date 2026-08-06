'use client';

import { useMemo } from 'react';

import {
  baseOption,
  binPosition,
  categoryAxis,
  histogram,
  referenceLine,
  seriesTooltip,
  strong,
  tooltipHtml,
  useChartTokens,
  useReducedMotion,
  valueAxis,
  type Bin,
  type EChartsOption,
} from '@beff/ui/chart';
import { ChartFigure } from '@beff/ui/chart-figure';
import { DataTable, type DataColumn } from '@beff/ui/data-table';
import { EChart } from '@beff/ui/echart';

import { CSV_NAMES, FIGURE_IDS } from '@/constants/figures';
import { formatters } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';
import { yieldWindow } from '@/lib/metrics';

import type { Formatters } from '@/lib/format';
import type { CohortReference, TrendPoint } from '@beff/api-client/types';

/** The copy this chart's tooltip and table need, so both can be tested alone. */
export interface DistributionCopy {
  range: string;
  batches: string;
}

/** `64.0 % to 66.0 %` — both edges formatted, never a bare number with a sign. */
export function binRange(bin: Bin, format: Formatters, copy: DistributionCopy): string {
  return copy.range
    .replace('{from}', format.percent(bin.start))
    .replace('{to}', format.percent(bin.end));
}

export function distributionTooltip(
  bin: Bin,
  total: number,
  format: Formatters,
  copy: DistributionCopy,
): string {
  return tooltipHtml([
    strong(binRange(bin, format, copy)),
    copy.batches.replace('{count}', format.count(bin.count)),
    format.percent(total === 0 ? 0 : (bin.count / total) * 100),
  ]);
}

/**
 * How often the line produced each level of first-pass yield.
 *
 * ## The question it answers, which no other chart on this page does
 *
 * `YieldTrendChart` beside it plots the same sixty batches in time order and
 * answers "which way is this going". This one throws time away deliberately and
 * answers "how repeatable is this line" — and the two are different problems
 * with different fixes. A line whose batches cluster tightly two points below
 * target has a *setting* wrong; a line with the same average spread across
 * twenty points has a *control* problem, and no amount of re-centring will fix
 * it. On a trend line those two look nearly identical.
 *
 * This is the chart a process engineer reaches for before talking about
 * capability, and it needs no new data: the batches are already in the payload.
 *
 * ## Why the bins are round and the limits are drawn
 *
 * Both from `histogram`/`binPosition` in the chart layer, and both for the same
 * reason: a distribution is only meaningful against the window it is supposed
 * to sit inside. The specification limits are dashed neutrals drawn *vertically*
 * here — same rule as every other reference in the app, rotated — and the
 * cohort median comes with them, because "am I in spec" and "am I good" are the
 * two questions and this chart can answer both at once.
 */
export function YieldDistributionChart({
  points,
  benchmark,
  lineKind,
  locale,
}: {
  points: readonly TrendPoint[];
  benchmark: CohortReference;
  lineKind: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const copy = t.dashboard.charts.yieldDistribution;
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const format = useMemo(() => formatters(locale), [locale]);

  const spec = yieldWindow(lineKind);

  const bins = useMemo(
    () =>
      histogram(
        points.map((point) => point.first_pass_yield_pct),
        // The limits and the cohort median are pulled into the range rather
        // than clipped out of it. A limit outside the axis is not drawn faintly
        // — it is not drawn at all, and the chart silently stops being a
        // comparison.
        {
          include: [spec.lowerLimit, spec.upperLimit, benchmark.first_pass_yield_p50_pct],
          maxBins: 10,
        },
      ),
    [points, spec, benchmark],
  );

  const columns = useMemo<DataColumn<Bin>[]>(
    () => [
      {
        key: 'range',
        header: copy.columnRange,
        rowHeader: true,
        render: (bin) => binRange(bin, format, copy),
        text: (bin) => binRange(bin, format, copy),
        // On the numeric edge, never on the rendered string: "100.0 %" sorts
        // before "64.0 %" alphabetically.
        sortValue: (bin) => bin.start,
      },
      {
        key: 'batches',
        header: copy.columnBatches,
        align: 'end',
        render: (bin) => format.count(bin.count),
        text: (bin) => format.count(bin.count),
        sortValue: (bin) => bin.count,
        filterRange: (bin) => bin.count,
      },
      {
        key: 'share',
        header: copy.columnShare,
        align: 'end',
        render: (bin) =>
          format.percent(points.length === 0 ? 0 : (bin.count / points.length) * 100),
        text: (bin) => format.percent(points.length === 0 ? 0 : (bin.count / points.length) * 100),
        sortValue: (bin) => bin.count,
      },
    ],
    [copy, format, points.length],
  );

  const option = useMemo<EChartsOption>(() => {
    const base = baseOption({ tokens, reducedMotion });

    /*
     * A reference is drawn only where it lands on the axis.
     *
     * `binPosition` returns null off the ends, and null means the line is
     * omitted rather than pinned to the edge — the same decision the yield
     * trend makes about an off-axis limit, for the same reason: a rule drawn at
     * the boundary of a plot reads as "you are at it".
     */
    const rules = [
      { value: spec.lowerLimit, label: copy.lowerLimit, strong: true },
      { value: spec.upperLimit, label: copy.upperLimit, strong: true },
      { value: benchmark.first_pass_yield_p50_pct, label: copy.cohortMedian, strong: false },
    ]
      .map((rule) => ({ ...rule, at: binPosition(bins, rule.value) }))
      .filter((rule): rule is typeof rule & { at: number } => rule.at !== null);

    return {
      ...base,
      xAxis: categoryAxis(tokens, {
        // The lower edge alone, unformatted. Twelve "64.0 %–66.0 %" labels do
        // not fit under any plot this page can give the chart, and the unit is
        // already in the caption and in every tooltip.
        data: bins.map((bin) => format.decimal(bin.start, 0)),
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          interval: 0,
          hideOverlap: true,
        },
      }),
      yAxis: valueAxis(tokens, {
        minInterval: 1,
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          formatter: (value: number) => format.count(value),
        },
      }),
      series: [
        {
          type: 'bar',
          name: copy.seriesName,
          data: bins.map((bin) => bin.count),
          itemStyle: {
            // The same hue the trend chart gives first-pass yield. Two views of
            // one measurement in two colours invites the reader to look for a
            // distinction that is not there.
            color: tokens['color-chart-series-1'],
            borderRadius: [2, 2, 0, 0],
          },
          // Bars touch, because the axis is continuous: a gap would say these
          // are twelve categories rather than one measurement cut into slices.
          barCategoryGap: '2%',
          markLine: {
            silent: true,
            symbol: 'none',
            data: rules.map((rule) =>
              referenceLine(tokens, {
                value: rule.at,
                label: rule.label,
                strong: rule.strong,
                axis: 'x',
              }),
            ),
          },
        },
      ],
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: seriesTooltip(bins, (bin) =>
          distributionTooltip(bin, points.length, format, copy),
        ),
      },
    };
  }, [bins, points.length, spec, benchmark, tokens, reducedMotion, format, copy]);

  return (
    <ChartFigure
      id={FIGURE_IDS.yieldDistribution}
      title={copy.title}
      description={copy.description}
      viewChartLabel={t.dashboard.table.viewChart}
      viewTableLabel={t.dashboard.table.viewTable}
      chart={<EChart option={option} height="20rem" />}
      table={
        <DataTable
          caption={copy.tableCaption}
          columns={columns}
          rows={bins}
          rowKey={(bin) => String(bin.start)}
          locale={locale}
          csvName={CSV_NAMES.yieldDistribution}
          copy={t.dashboard.table}
        />
      }
    />
  );
}
