'use client';

import { useMemo } from 'react';

import { ChartFigure } from '@/components/ChartFigure';
import { DataTable, type DataColumn } from '@/components/DataTable';
import { EChart } from '@/components/EChart';
import {
  baseOption,
  categoryAxis,
  chartFormatters,
  niceBounds,
  useChartTokens,
  useReducedMotion,
  valueAxis,
  type EChartsOption,
} from '@/lib/chart';
import { seriesTooltip, strong, tooltipHtml } from '@/lib/chart/tooltip';
import { getDictionary, type Locale } from '@/lib/i18n';

import type { ChartFormatters } from '@/lib/chart';
import type { TrendPoint } from '@beff/api-client/types';

/** The copy this chart's tooltip needs, so the builder can be tested alone. */
export interface ThroughputTooltipCopy {
  seriesPassed: string;
  seriesScrapped: string;
  columnStarted: string;
}

/**
 * All three counts, not just the segment under the cursor.
 *
 * A stacked bar answers "how much of this run was lost" only if the reader can
 * see the whole run. Showing one segment's count would make the reader do the
 * arithmetic the chart exists to save them.
 */
export function throughputTooltip(
  point: TrendPoint,
  format: ChartFormatters,
  copy: ThroughputTooltipCopy,
): string {
  return tooltipHtml([
    strong(point.batch_code),
    format.fullDate(point.started_at),
    `${copy.seriesPassed}: ${format.count(point.cells_passed)}`,
    `${copy.seriesScrapped}: ${format.count(point.cells_scrapped)}`,
    `${copy.columnStarted}: ${format.count(point.cells_started)}`,
  ]);
}

/**
 * Cells started per batch, split into what passed and what was scrapped.
 *
 * ## Why counts and not the rate again
 *
 * The yield chart already plots the rate, and a rate discards the size of the
 * run it came from. A 42% yield on a 180-cell trial batch and a 42% yield on a
 * 1 400-cell production batch are the same point on that chart and completely
 * different events — the second one is most of a week's output. Plotting the
 * counts is what makes batch size visible, and stacking them is what makes the
 * loss legible as a share of the run at the same time.
 *
 * This is the chart the yield trend deliberately did **not** become by growing
 * a second y-axis.
 *
 * ## Colour, and the encoding that survives without it
 *
 * Two categorical hues from the Okabe-Ito set the token file already ships —
 * chosen because they stay distinguishable under the common colour vision
 * deficiencies, which a red/green "good and bad" pair does not.
 *
 * `success`/`warning`/`danger` are deliberately *not* used. Those are reserved
 * for in-spec versus out-of-spec, and spending them here would make the palette
 * mean two different things on one screen: a red segment would read as "out of
 * tolerance" when it means "scrapped", which on a pilot line is normal and
 * expected.
 *
 * Position carries the meaning regardless of hue: scrapped cells always sit on
 * top of passed cells, in every bar, so the stack reads the same in greyscale.
 */
export function ThroughputChart({
  points,
  locale,
}: {
  points: readonly TrendPoint[];
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const copy = t.dashboard.charts.throughput;
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const format = useMemo(() => chartFormatters(locale), [locale]);

  const columns = useMemo<DataColumn<TrendPoint>[]>(
    () => [
      {
        key: 'batch',
        header: copy.columnBatch,
        rowHeader: true,
        render: (point) => point.batch_code,
        text: (point) => point.batch_code,
        sortValue: (point) => point.batch_code,
      },
      {
        key: 'started',
        header: copy.columnStarted,
        align: 'end',
        render: (point) => format.count(point.cells_started),
        text: (point) => format.count(point.cells_started),
        // The raw count, never the grouped string: '1.200' and '180' compare
        // in the wrong order lexically, and the separator is locale-dependent.
        sortValue: (point) => point.cells_started,
        filterRange: (point) => point.cells_started,
      },
      {
        key: 'passed',
        header: copy.seriesPassed,
        align: 'end',
        render: (point) => format.count(point.cells_passed),
        text: (point) => format.count(point.cells_passed),
        sortValue: (point) => point.cells_passed,
      },
      {
        key: 'scrapped',
        header: copy.seriesScrapped,
        align: 'end',
        render: (point) => format.count(point.cells_scrapped),
        text: (point) => format.count(point.cells_scrapped),
        sortValue: (point) => point.cells_scrapped,
      },
    ],
    [copy, format],
  );

  const option = useMemo<EChartsOption>(() => {
    const base = baseOption({ tokens, reducedMotion });

    return {
      ...base,
      legend: {
        // Always present with two series — identity must never be colour-alone,
        // and two stacked segments cannot be direct-labelled without printing a
        // number on every bar.
        show: true,
        top: 0,
        left: 0,
        icon: 'rect',
        itemWidth: 10,
        itemHeight: 10,
        // Room between the two entries. Without it the swatch of the second
        // sits hard against the last letter of the first, which reads as a
        // truncated label rather than as two items — and "Passed end-of-line"
        // is long enough in English and longer in German.
        itemGap: 20,
        // Text in a text token, never in the series colour it sits beside.
        textStyle: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          // Never clip a series name. Identity must not depend on the reader
          // guessing the rest of the word.
          overflow: 'none' as const,
        },
      },
      // Room for two stacked things above the plot: the legend, and the axis
      // name beneath it. At 32 the name landed on top of the highest tick.
      grid: { ...base.grid, top: 56 },
      xAxis: categoryAxis(tokens, {
        data: points.map((point) => format.axisDate(point.started_at)),
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          interval: 'auto' as const,
          hideOverlap: true,
        },
      }),
      yAxis: valueAxis(tokens, {
        // Anchored at zero — a bar chart whose baseline is not zero misstates
        // every length on it — and capped just above the tallest run rather
        // than wherever the default rounding lands. ECharts chose 1 500 for a
        // 1 300-cell maximum, which is a seventh of the plot showing nothing.
        // No padding above. A line chart needs air so the series does not run
        // into the frame, but a bar's top *is* its value — rounding up to the
        // next gridline already leaves room, and padding on top of that is what
        // put a 1 400-cell maximum on a 1 600 axis.
        ...niceBounds([0, ...points.map((point) => point.cells_started)], {
          padRatio: 0,
          maxIntervals: 8,
          clampMin: 0,
        }),
        // The unit, named once on the axis rather than repeated on every tick.
        //
        // `nameGap` has to clear the topmost tick label, not just the axis
        // line: ECharts places an `end`-located name above the axis and the
        // highest tick immediately below it, so the default gap put "Cells"
        // straight through "1,600". The grid is pushed down by the same amount
        // to make room, otherwise the name simply collides with the legend
        // instead.
        name: copy.axisLabel,
        nameLocation: 'end' as const,
        nameGap: 18,
        nameTextStyle: { color: tokens['color-text-muted'], fontSize: 11, align: 'left' as const },
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          formatter: (value: number) => format.count(value),
        },
      }),
      series: [
        {
          type: 'bar',
          stack: 'cells',
          name: copy.seriesPassed,
          data: points.map((point) => point.cells_passed),
          itemStyle: { color: tokens['color-chart-series-1'] },
          // A 2px gap in the surface colour between the two segments, so the
          // boundary is a real edge rather than a hue change — the one place a
          // stacked bar is genuinely hard to read without colour.
          barCategoryGap: '30%',
        },
        {
          type: 'bar',
          stack: 'cells',
          name: copy.seriesScrapped,
          data: points.map((point) => point.cells_scrapped),
          itemStyle: {
            color: tokens['color-chart-series-2'],
            borderColor: tokens['color-surface-base'],
            borderWidth: 2,
            // Only the edge that touches the segment below it.
            borderType: 'solid',
          },
        },
      ],
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: seriesTooltip(points, (point) => throughputTooltip(point, format, copy)),
      },
    };
  }, [points, tokens, reducedMotion, format, copy]);

  return (
    <ChartFigure
      id="throughput"
      title={copy.title}
      description={copy.description}
      viewChartLabel={t.dashboard.table.viewChart}
      viewTableLabel={t.dashboard.table.viewTable}
      chart={<EChart option={option} height="20rem" />}
      table={
        <DataTable
          caption={copy.tableCaption}
          columns={columns}
          rows={points}
          rowKey={(point) => point.batch_code}
          locale={locale}
          csvName="cells-by-batch"
          copy={t.dashboard.table}
        />
      }
    />
  );
}
