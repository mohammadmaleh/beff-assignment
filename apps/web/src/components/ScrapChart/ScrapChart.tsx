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

import type { Formatters } from '@/lib/format';

export interface ScrapRow {
  process_step: string;
  scrap_rate_pct: number;
  committed_value_eur: number;
}

/** The copy this chart's tooltip needs, so the builder can be tested alone. */
export interface ScrapTooltipCopy {
  columnScrap: string;
  columnCost: string;
}

/**
 * Both numbers for one step, the same pairing `ScrapCostChart` offers.
 *
 * The rate is what this chart plots; the committed value is what the chart
 * below it plots. Carrying both in each tooltip is what lets a reader see the
 * disagreement between them - coating leads on rate, formation on cost -
 * without switching figures.
 */
export function scrapTooltip(
  row: ScrapRow,
  steps: Readonly<Record<string, string>>,
  format: Formatters,
  copy: ScrapTooltipCopy,
): string {
  return tooltipHtml([
    strong(translate(steps, row.process_step)),
    `${copy.columnScrap}: ${format.percent(row.scrap_rate_pct)}`,
    `${copy.columnCost}: ${format.euro(row.committed_value_eur)}`,
  ]);
}

/**
 * ## Scrap by process step
 *
 * ### Why the table is the real thing
 *
 * The bars are `aria-hidden`. The `<table>` beside them is not an "alternative"
 * bolted on for compliance - it is the authoritative rendering, and the chart
 * is a fast visual index into it. That inversion is deliberate: a chart built
 * accessible-first cannot drift out of sync with its own description, because
 * there is only one source of numbers.
 *
 * This component set that rule and was then the last one still drawing itself.
 * It carried its own `<details>` disclosure, its own table markup, its own
 * `Intl.NumberFormat` instances - which is exactly how it came to render `7,8%`
 * in German, where the space before the sign is mandatory and non-breaking -
 * and, longest of all, its own bars: a `<ul>` of nested spans sized by a
 * percentage width against the largest value.
 *
 * Those bars were not wrong, and they cost nothing to render. They were simply
 * the only figure in the product not drawn by the chart layer, which meant the
 * axis style, the label placement and the tooltip beside them were decided here
 * instead of in `@beff/ui/chart` - five charts, four of them agreeing. It is an
 * ECharts bar series now, and the only thing that reads differently is that the
 * value axis has gridlines it previously implied.
 *
 * ### Why there is no colour scale
 *
 * Every bar is one neutral. Colouring by severity would mean encoding a
 * quantity in hue, which fails for roughly one man in twelve, and `success` /
 * `warning` / `danger` are reserved for *in spec* versus *out of spec* - using
 * them for "more scrap" would make the palette mean two different things in one
 * screen. Magnitude is carried by bar length and by the number printed at the
 * end of every bar, which is legible in greyscale and to a screen reader.
 *
 * ### Ordering
 *
 * Process order, never sorted by size, because a cell lost at formation has
 * absorbed every upstream cost and the position of a bar carries economic
 * meaning that re-sorting would destroy. The table *offers* sorting - that is
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
  const steps = t.dashboard.steps;
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const format = useMemo(() => formatters(locale), [locale]);

  const ordered = useMemo(
    () => [...rows].sort((a, b) => order.indexOf(a.process_step) - order.indexOf(b.process_step)),
    [rows, order],
  );

  const columns = useMemo<DataColumn<ScrapRow>[]>(
    () => [
      {
        key: 'step',
        header: t.dashboard.columnStep,
        rowHeader: true,
        render: (row) => translate(steps, row.process_step),
        text: (row) => translate(steps, row.process_step),
        sortValue: (row) => translate(steps, row.process_step),
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

  const option = useMemo<EChartsOption>(() => {
    const base = baseOption({ tokens, reducedMotion });
    // The bars are handed over reversed, because a category axis counts up from
    // the bottom and process order has to read top-to-bottom: mixing first,
    // end-of-line test last. Everything indexed against the drawing - the
    // tooltip included - has to use the same reversed array.
    const drawn = [...ordered].reverse();

    return {
      ...base,
      grid: { ...base.grid, right: 32 },
      // Horizontal bars: twelve process-step names do not fit under a vertical
      // axis in English and certainly not in German, where
      // "Elektrolytbefüllung" is one word. Rotating the labels to fit is the
      // usual fix and it makes the reader tilt their head.
      xAxis: valueAxis(tokens, {
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 11,
          formatter: (value: number) => format.percent(value),
        },
      }),
      yAxis: categoryAxis(tokens, {
        data: drawn.map((row) => translate(steps, row.process_step)),
        axisLine: { show: false },
      }),
      series: [
        {
          type: 'bar',
          name: t.dashboard.columnScrap,
          data: drawn.map((row) => row.scrap_rate_pct),
          itemStyle: {
            // One neutral for every bar. Colouring by severity would encode a
            // quantity in hue, which fails for roughly one man in twelve, and
            // `warning`/`danger` are reserved here for in-spec versus
            // out-of-spec - using them for "more scrap" would make the palette
            // mean two different things on one screen.
            color: tokens['color-chart-series-2'],
            // Square against the baseline: a bar rounded at the axis end reads
            // as floating away from zero.
            borderRadius: [0, 4, 4, 0],
          },
          barMaxWidth: 18,
          // The figure printed at the end of every bar, which is what makes the
          // magnitude legible in greyscale without a colour scale.
          label: {
            show: true,
            position: 'right',
            color: tokens['color-text-muted'],
            fontSize: 11,
            formatter: (params: { value: unknown }) => format.percent(Number(params.value)),
          },
        },
      ],
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: seriesTooltip(drawn, (row) =>
          scrapTooltip(row, steps, format, {
            columnScrap: t.dashboard.columnScrap,
            columnCost: t.dashboard.columnCost,
          }),
        ),
      },
    };
  }, [ordered, steps, tokens, reducedMotion, format, t]);

  return (
    <ChartFigure
      id={FIGURE_IDS.scrapByStep}
      title={t.dashboard.scrapChartTitle}
      description={t.dashboard.scrapChartDescription}
      viewChartLabel={t.dashboard.table.viewChart}
      viewTableLabel={t.dashboard.table.viewTable}
      chart={<EChart option={option} height="24rem" />}
      table={
        <DataTable
          caption={t.dashboard.scrapTableCaption}
          columns={columns}
          rows={ordered}
          rowKey={(row) => row.process_step}
          locale={locale}
          csvName={CSV_NAMES.scrapByStep}
          copy={t.dashboard.table}
        />
      }
    />
  );
}
