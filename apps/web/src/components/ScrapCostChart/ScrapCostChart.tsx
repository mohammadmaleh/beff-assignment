'use client';

import { useMemo } from 'react';

import {
  baseOption,
  categoryAxis,
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
import { getDictionary, translate, type Locale } from '@/lib/i18n';
import { PROCESS_STEPS } from '@/lib/metrics';

import type { Formatters } from '@/lib/format';
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
  steps: Readonly<Record<string, string>>,
  format: Formatters,
  copy: ScrapCostTooltipCopy,
): string {
  return tooltipHtml([
    strong(translate(steps, row.process_step)),
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
  const steps = t.dashboard.steps;
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const format = useMemo(() => formatters(locale), [locale]);

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

  const columns = useMemo<DataColumn<ScrapByStep>[]>(
    () => [
      {
        key: 'step',
        header: copy.columnStep,
        rowHeader: true,
        render: (row) => translate(steps, row.process_step),
        text: (row) => translate(steps, row.process_step),
        sortValue: (row) => translate(steps, row.process_step),
      },
      {
        key: 'scrap',
        header: copy.columnScrap,
        align: 'end',
        render: (row) => format.percent(row.scrap_rate_pct),
        text: (row) => format.percent(row.scrap_rate_pct),
        sortValue: (row) => row.scrap_rate_pct,
      },
      {
        key: 'cost',
        header: copy.seriesName,
        align: 'end',
        render: (row) => format.euro(row.committed_value_eur),
        text: (row) => format.euro(row.committed_value_eur),
        sortValue: (row) => row.committed_value_eur,
        filterRange: (row) => row.committed_value_eur,
      },
    ],
    [copy, format, steps],
  );

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
        data: [...ordered].reverse().map((row) => translate(steps, row.process_step)),
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
      id={FIGURE_IDS.scrapCost}
      title={copy.title}
      description={copy.description}
      viewChartLabel={t.dashboard.table.viewChart}
      viewTableLabel={t.dashboard.table.viewTable}
      chart={<EChart option={option} height="24rem" />}
      table={
        /*
         * `ordered` — process order, the same array the bars are drawn from.
         * Sorting is offered and never imposed: a cell lost at formation has
         * absorbed every upstream cost, so position carries economic meaning
         * that a default sort by size would quietly destroy.
         */
        <DataTable
          caption={copy.tableCaption}
          columns={columns}
          rows={ordered}
          rowKey={(row) => row.process_step}
          locale={locale}
          csvName={CSV_NAMES.scrapCost}
          copy={t.dashboard.table}
        />
      }
    />
  );
}
