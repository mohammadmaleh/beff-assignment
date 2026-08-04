'use client';

import { useMemo } from 'react';

import { ChartFigure } from '@/components/ChartFigure';
import { EChart } from '@/components/EChart';
import {
  baseOption,
  categoryAxis,
  chartFormatters,
  niceBounds,
  referenceLine,
  useChartTokens,
  useReducedMotion,
  valueAxis,
  type EChartsOption,
} from '@/lib/chart';
import { seriesTooltip, strong, tooltipHtml } from '@/lib/chart/tooltip';
import { getDictionary, type Locale } from '@/lib/i18n';
import { yieldWindow } from '@/lib/metrics';

import type { ChartFormatters } from '@/lib/chart';
import type { CohortReference, TrendPoint } from '@beff/api-client/types';

/** The copy this chart's tooltip needs, so the builder can be tested alone. */
export interface YieldTooltipCopy {
  seriesMeasured: string;
  tooltipCells: string;
}

/**
 * What a reader sees when they track along the yield line.
 *
 * The counts are here as well as the rate, deliberately. "812 of 1 140 cells"
 * is the form a process engineer reasons in, and it cannot be recovered from a
 * rounded percentage — 68.0% of 1 140 is 775.2, and the batch passed 812.
 */
export function yieldTooltip(
  point: TrendPoint,
  format: ChartFormatters,
  copy: YieldTooltipCopy,
): string {
  return tooltipHtml([
    strong(point.batch_code),
    format.fullDate(point.started_at),
    `${copy.seriesMeasured}: ${format.percent(point.first_pass_yield_pct)}`,
    copy.tooltipCells
      .replace('{passed}', format.count(point.cells_passed))
      .replace('{started}', format.count(point.cells_started)),
  ]);
}

/**
 * First-pass yield, batch by batch, against the specification window and the
 * cohort.
 *
 * ## The question it answers
 *
 * The headline `SpecBand` says where today's reading sits. This says how it got
 * there — and those are different decisions. A pilot line at 71.8% inside a
 * 40–80% window is fine; a pilot line at 71.8% that was at 78% three weeks ago
 * is a process that is drifting, and only one of those two facts is visible in
 * a single number.
 *
 * ## Three things are drawn, and only one of them is data
 *
 * The measured series is a solid line in `series-1`. The specification window
 * is a shaded band. The cohort median and P90 are **dashed neutrals**.
 *
 * That is the app's reference-line rule: a rule you are judged against never
 * wears a series colour and is never solid. It means the distinction between
 * "what the line did" and "what it is measured against" survives greyscale,
 * colour blindness and a printout — none of which a legend alone survives,
 * because a legend tells you which colour is which and says nothing once the
 * colours are gone.
 *
 * ## Why there is no second y-axis
 *
 * There was a real temptation to overlay cells started, so the reader could see
 * whether a bad yield was also a small batch. Two scales on one plot is the
 * single most reliable way to make a chart lie — the crossing point of the two
 * lines is an artefact of the axis ranges, and readers read it as meaning
 * something. Throughput gets its own chart instead.
 */
export function YieldTrendChart({
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
  const copy = t.dashboard.charts.yieldTrend;
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const format = useMemo(() => chartFormatters(locale), [locale]);

  const spec = yieldWindow(lineKind);

  const option = useMemo<EChartsOption>(() => {
    const labels = points.map((point) => format.axisDate(point.started_at));
    const values = points.map((point) => point.first_pass_yield_pct);

    const bounds = niceBounds(
      [...values, benchmark.first_pass_yield_p50_pct, benchmark.first_pass_yield_p90_pct],
      { padRatio: 0.18, minPad: 2, maxIntervals: 5, clampMin: 0, clampMax: 100 },
    );

    /*
     * A specification limit is drawn only when it is on the axis.
     *
     * The band used to be a shaded `markArea` across the whole window. Once the
     * axis is scaled to the data, that area covers the entire plot and says
     * nothing — a solid grey rectangle behind everything. Drawn as limits
     * instead, they appear when the line approaches one and stay out of the way
     * when it does not, which is when they carry information.
     *
     * Off-axis limits are omitted rather than clamped to the edge. A limit
     * pinned to the top of the plot reads as "you are at the limit", which on a
     * line running 65% against an 80% ceiling would be a lie.
     */
    const limits = [
      { value: spec.lowerLimit, label: copy.lowerLimit },
      { value: spec.upperLimit, label: copy.upperLimit },
    ].filter((limit) => limit.value >= bounds.min && limit.value <= bounds.max);

    return {
      ...baseOption({ tokens, reducedMotion }),
      xAxis: categoryAxis(tokens, {
        data: labels,
        // A sixty-batch window would otherwise print sixty dates on top of one
        // another. `auto` thins them to whatever fits, which is also what makes
        // the German month abbreviations safe — they are longer.
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          interval: 'auto' as const,
          hideOverlap: true,
        },
      }),
      yAxis: valueAxis(tokens, {
        /*
         * Scaled to everything actually drawn — the batches and the two cohort
         * lines — and then rounded outward.
         *
         * This was pinned to the specification window, on the reasoning that an
         * auto-scaled axis makes a two-point wobble fill the plot and look like
         * a collapse. That reasoning is sound and the implementation was not: a
         * pilot line's window is 40-80%, so the band covered 73% of the plot and
         * two months of real movement — 65% to 77% — was squeezed into a fifth
         * of the height. The chart shouted "in spec" and whispered the trend.
         *
         * `minPad` is what preserves the original intent. A flat series still
         * gets at least two percentage points of air, so it reads as flat rather
         * than being magnified into drama.
         */
        ...bounds,
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          formatter: (value: number) => format.percent(value),
        },
      }),
      series: [
        {
          type: 'line',
          name: copy.seriesMeasured,
          data: values,
          // 2px, and no symbol until hovered. Sixty dots on a sixty-point line
          // is texture, not information; the crosshair marks the point being
          // read, which is the only one that needs marking.
          lineStyle: { width: 2, color: tokens['color-chart-series-1'] },
          itemStyle: { color: tokens['color-chart-series-1'] },
          showSymbol: false,
          symbolSize: 8,
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              // Specification limits first, drawn `strong`: they are rules the
              // line is held to. The cohort lines below are context, and the
              // weight difference is what says which is which.
              ...limits.map((limit) =>
                referenceLine(tokens, { value: limit.value, label: limit.label, strong: true }),
              ),
              referenceLine(tokens, {
                value: benchmark.first_pass_yield_p50_pct,
                label: copy.cohortMedian,
              }),
              referenceLine(tokens, {
                value: benchmark.first_pass_yield_p90_pct,
                label: copy.cohortTop,
              }),
            ],
          },
        },
      ],
      tooltip: {
        ...baseOption({ tokens, reducedMotion }).tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { color: tokens['color-border-default'], width: 1, type: 'solid' },
        },
        formatter: seriesTooltip(points, (point) => yieldTooltip(point, format, copy)),
      },
    };
  }, [points, benchmark, spec, tokens, reducedMotion, format, copy]);

  return (
    <ChartFigure
      id="yield-trend"
      title={copy.title}
      description={copy.description.replace('{n}', String(benchmark.sample_size))}
      viewChartLabel={t.dashboard.table.viewChart}
      viewTableLabel={t.dashboard.table.viewTable}
      chart={<EChart option={option} height="20rem" />}
      table={
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--type-ui-size-sm)]">
            <caption className="text-text-muted pb-3 text-start">{copy.tableCaption}</caption>
            <thead>
              <tr className="border-border-default border-b">
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {copy.columnBatch}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {copy.columnDate}
                </th>
                <th scope="col" className="py-2 pe-4 text-end font-medium">
                  {copy.columnYield}
                </th>
                <th scope="col" className="py-2 text-end font-medium">
                  {copy.columnCells}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.batch_code} className="border-border-default border-b">
                  <th scope="row" className="py-2 pe-4 text-start font-normal">
                    {point.batch_code}
                  </th>
                  <td className="py-2 pe-4">{format.fullDate(point.started_at)}</td>
                  <td className="py-2 pe-4 text-end tabular-nums">
                    {format.percent(point.first_pass_yield_pct)}
                  </td>
                  <td className="py-2 text-end tabular-nums">
                    {copy.tooltipCells
                      .replace('{passed}', format.count(point.cells_passed))
                      .replace('{started}', format.count(point.cells_started))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    />
  );
}
