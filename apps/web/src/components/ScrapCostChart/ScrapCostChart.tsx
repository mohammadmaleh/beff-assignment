'use client';

import { useMemo } from 'react';

import { ChartFigure } from '@/components/ChartFigure';
import { EChart } from '@/components/EChart';
import {
  baseOption,
  categoryAxis,
  chartFormatters,
  useChartTokens,
  useReducedMotion,
  valueAxis,
  type EChartsOption,
} from '@/lib/chart';
import { seriesTooltip, strong, tooltipHtml } from '@/lib/chart/tooltip';
import { getDictionary, type Locale } from '@/lib/i18n';
import { PROCESS_STEPS } from '@/lib/metrics';

import type { ChartFormatters } from '@/lib/chart';
import type { ScrapByStep } from '@beff/api-client/types';

/** The copy this chart's tooltip needs, so the builder can be tested alone. */
export interface ScrapCostTooltipCopy {
  seriesName: string;
  columnScrap: string;
}

/**
 * Both numbers for one step: what it cost, and what share of cells it lost.
 *
 * This pairing is the chart's whole reason for existing beside `ScrapChart`.
 * Coating leads on rate and formation leads on cost, and a reader can only see
 * that if hovering one step shows them both figures without switching tables.
 */
export function scrapCostTooltip(
  row: ScrapByStep,
  steps: Record<string, string>,
  format: ChartFormatters,
  copy: ScrapCostTooltipCopy,
): string {
  return tooltipHtml([
    strong(steps[row.process_step] ?? row.process_step),
    `${copy.seriesName}: ${format.euro(row.committed_value_eur)}`,
    `${copy.columnScrap}: ${format.percent(row.scrap_rate_pct)}`,
  ]);
}

/**
 * What the scrap at each process step was worth, in euros.
 *
 * ## Why this chart exists next to one that looks like it
 *
 * `ScrapChart` directly above plots the scrap **rate** by step, and on this
 * data its tallest bar is coating. This plots the **committed value** lost at
 * each step, and its tallest bar is formation. Those two charts disagree, and
 * the disagreement is the entire product thesis: a cell scrapped at formation
 * has absorbed every upstream cost, so the step that loses the most cells and
 * the step that loses the most money are not the same step.
 *
 * That fact was already in the payload — `committed_value_eur` sat in a column
 * of a table behind a `<details>`. Nobody reads a collapsed table. Drawn beside
 * the rate it takes about a second to see, which is the difference between the
 * argument being *available* and the argument being *made*.
 *
 * ## Ordering, and why it is not sorted by size
 *
 * Process order, always. A Pareto sort would put the largest bar first and read
 * more "correctly" as a chart, and it would destroy the meaning: the horizontal
 * position of a bar *is* the cell's progress through the line, which is why
 * committed value rises across it. Sorted by size, the rising staircase that
 * makes the argument disappears.
 *
 * ## One series, so no legend
 *
 * A single measure needs no legend — the title names it. The bars carry their
 * value as a direct label at the end, which is legible in greyscale and is what
 * the accompanying table would otherwise be the only source of.
 */
export function ScrapCostChart({ rows, locale }: { rows: readonly ScrapByStep[]; locale: Locale }) {
  const t = getDictionary(locale);
  const copy = t.dashboard.charts.scrapCost;
  const steps = t.dashboard.steps as Record<string, string>;
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const format = useMemo(() => chartFormatters(locale), [locale]);

  const ordered = useMemo(() => {
    // Widened to `readonly string[]` on purpose. `PROCESS_STEPS` is a const
    // tuple, so `indexOf` only accepts one of its twelve literals — but
    // `process_step` arrives from the API as a plain string, and a step the
    // frontend does not know about must sort to the front rather than fail to
    // compile. `ScrapChart` takes the order as a `readonly string[]` prop for
    // the same reason.
    const order: readonly string[] = PROCESS_STEPS;
    return [...rows].sort((a, b) => order.indexOf(a.process_step) - order.indexOf(b.process_step));
  }, [rows]);

  const option = useMemo<EChartsOption>(() => {
    const base = baseOption({ tokens, reducedMotion });

    return {
      ...base,
      grid: { ...base.grid, right: 24 },
      // Horizontal bars: twelve process-step names do not fit under a vertical
      // axis in English and certainly not in German, where "Elektrolytbefüllung"
      // is one word. Rotating the labels to fit is the usual fix and it makes
      // the reader tilt their head.
      xAxis: valueAxis(tokens, {
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          formatter: (value: number) => format.euro(value),
        },
      }),
      yAxis: categoryAxis(tokens, {
        // Reversed, because a category axis counts up from the bottom and
        // process order has to read top-to-bottom: mixing first, end-of-line
        // test last.
        data: [...ordered].reverse().map((row) => steps[row.process_step] ?? row.process_step),
        axisLine: { show: false },
      }),
      series: [
        {
          type: 'bar',
          name: copy.seriesName,
          data: [...ordered].reverse().map((row) => row.committed_value_eur),
          itemStyle: {
            color: tokens['color-chart-series-2'],
            // 4px rounded on the data end only, square against the baseline —
            // a bar rounded at the axis end reads as floating away from zero.
            borderRadius: [0, 4, 4, 0],
          },
          barMaxWidth: 18,
          label: {
            show: true,
            position: 'right',
            color: tokens['color-text-muted'],
            fontSize: 11,
            formatter: (params: { value: unknown }) => format.euro(Number(params.value)),
          },
        },
      ],
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        // Against the reversed list, because that is the order the bars were
        // handed to ECharts — `dataIndex` counts up the axis, and the axis is
        // reversed so process order reads top-to-bottom.
        formatter: seriesTooltip([...ordered].reverse(), (row) =>
          scrapCostTooltip(row, steps, format, copy),
        ),
      },
    };
  }, [ordered, steps, tokens, reducedMotion, format, copy]);

  return (
    <ChartFigure
      id="scrap-cost"
      title={copy.title}
      description={copy.description}
      showTableLabel={t.dashboard.showTable}
      tableCaption={copy.tableCaption}
      chart={<EChart option={option} height="24rem" />}
      table={
        <>
          <thead>
            <tr className="border-border-default border-b">
              <th scope="col" className="py-2 pe-4 text-start font-medium">
                {copy.columnStep}
              </th>
              <th scope="col" className="py-2 pe-4 text-end font-medium">
                {copy.columnScrap}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {copy.seriesName}
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <tr key={row.process_step} className="border-border-default border-b">
                <th scope="row" className="py-2 pe-4 text-start font-normal">
                  {steps[row.process_step] ?? row.process_step}
                </th>
                <td className="py-2 pe-4 text-end tabular-nums">
                  {format.percent(row.scrap_rate_pct)}
                </td>
                <td className="py-2 text-end tabular-nums">
                  {format.euro(row.committed_value_eur)}
                </td>
              </tr>
            ))}
          </tbody>
        </>
      }
    />
  );
}
