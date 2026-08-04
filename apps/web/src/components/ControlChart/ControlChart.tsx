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

import type { ChartFormatters } from '@/lib/chart';
import type { ParameterPoint, ParameterSeries } from '@beff/api-client/types';

/** The copy this chart's tooltip needs, so the builder can be tested alone. */
export interface ControlTooltipCopy {
  inSpec: string;
  outOfSpec: string;
}

/** Whether a reading has left the window it is judged against. Limits are inclusive. */
export function breaches(value: number, series: ParameterSeries): boolean {
  return value < series.lower_limit || value > series.upper_limit;
}

/**
 * The reading, its unit, and the verdict as a word.
 *
 * The verdict is spelled out rather than left to the marker's colour. On the
 * drawing a breaching point is larger *and* red; here it is a sentence — which
 * is what makes the colour a redundant third encoding rather than the only one.
 */
export function controlTooltip(
  point: ParameterPoint,
  series: ParameterSeries,
  format: ChartFormatters,
  copy: ControlTooltipCopy,
): string {
  return tooltipHtml([
    format.fullDate(point.started_at),
    strong(`${format.decimal(point.value, 1)} ${series.unit}`),
    breaches(point.value, series) ? copy.outOfSpec : copy.inSpec,
  ]);
}

/**
 * One process parameter over time, against the limits it is judged by.
 *
 * ## What it adds over the spec band
 *
 * `SpecBand` renders the newest reading against its window and answers *is this
 * in spec*. This answers *how did it get here, and is the process stable* —
 * which is the question a control chart was invented for, and the one that
 * decides whether an out-of-spec reading is an outlier to re-measure or a drift
 * to go and find the cause of.
 *
 * On the demo line those two readings tell genuinely different stories. Energy
 * density is out of spec today, which the band shows. It has also been falling
 * steadily for two months, which only this shows — and "falling since week
 * three" is a diagnosis where "out of spec" is only a symptom.
 *
 * ## Small multiples, not one chart with three lines
 *
 * Porosity is a percentage around 32, areal loading is mg/cm² around 21, energy
 * density is Wh/kg around 250. Three measures with three scales on one plot
 * means either a second y-axis — where the crossing point of two lines is an
 * artefact of the axis ranges that readers reliably mistake for meaning — or
 * normalising them all to a common index, which throws away the units and the
 * limits at the same time.
 *
 * A grid of one-parameter charts keeps every scale honest, keeps every limit
 * drawn in the unit it was set in, and is why this component renders *one*
 * series and the dashboard renders several of it.
 *
 * ## Colour is not the verdict
 *
 * The in-spec region is a shaded band and the limits are dashed reference
 * lines, so "inside" and "outside" are positional facts. Points that breach a
 * limit are additionally drawn as a filled marker in `danger` — that colour
 * *is* reserved for out-of-spec, which is exactly what this is, and it is a
 * second encoding on top of the position rather than the only one.
 */
export function ControlChart({
  series,
  label,
  locale,
}: {
  series: ParameterSeries;
  /** The parameter's display name, already translated by the caller. */
  label: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const copy = t.dashboard.charts.control;
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const format = useMemo(() => chartFormatters(locale), [locale]);

  // One definition of "out of spec" for the whole component — the drawing, the
  // description and the table all read it. Three inline comparisons is three
  // chances for one of them to use `<=` and disagree with the other two about a
  // reading sitting exactly on a limit.
  const breached = useMemo(
    () => series.points.filter((point) => breaches(point.value, series)),
    [series],
  );

  const option = useMemo<EChartsOption>(() => {
    const base = baseOption({ tokens, reducedMotion });
    const values = series.points.map((point) => point.value);

    // The axis has to hold the data *and* both limits with room for the
    // dashed labels. Scaled to the data alone, a limit that is never breached
    // sits outside the plot and the chart silently stops showing what it is
    // measured against.
    //
    // Rounded outward rather than padded by a raw fraction. `(high - low) *
    // 0.18` produced bounds like 231 and 269.05, and ECharts prints axis labels
    // from those numbers verbatim — a control chart whose gridlines land on 231
    // asks the reader to do arithmetic to place a reading.
    const bounds = niceBounds([...values, series.lower_limit, series.upper_limit], {
      padRatio: 0.15,
      minPad: 1,
      maxIntervals: 5,
    });

    const outOfSpec = (value: number): boolean => breaches(value, series);

    return {
      ...base,
      grid: { ...base.grid, top: 20, right: 12 },
      xAxis: categoryAxis(tokens, {
        data: series.points.map((point) => format.axisDate(point.started_at)),
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 10,
          interval: 'auto' as const,
          hideOverlap: true,
        },
      }),
      yAxis: valueAxis(tokens, {
        ...bounds,
        axisLabel: {
          color: tokens['color-text-muted'],
          fontSize: 10,
          formatter: (value: number) => format.decimal(value, 0),
        },
      }),
      series: [
        {
          type: 'line',
          name: label,
          data: values,
          lineStyle: { width: 1.5, color: tokens['color-chart-series-1'] },
          showSymbol: true,
          // Small enough to read as a sampled series rather than as a set of
          // labelled points, large enough to be a hit target.
          symbolSize: (value: unknown) => (outOfSpec(Number(value)) ? 9 : 3),
          itemStyle: {
            color: (params: { value: unknown }) =>
              outOfSpec(Number(params.value))
                ? tokens['color-status-danger-fg']
                : tokens['color-chart-series-1'],
          },
          markArea: {
            silent: true,
            itemStyle: { color: tokens['color-surface-sunken'], opacity: 0.5 },
            label: { show: false },
            data: [[{ yAxis: series.lower_limit }, { yAxis: series.upper_limit }]],
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              referenceLine(tokens, {
                value: series.lower_limit,
                label: copy.lowerLimit,
                strong: true,
              }),
              referenceLine(tokens, {
                value: series.upper_limit,
                label: copy.upperLimit,
                strong: true,
              }),
              ...(series.target === null
                ? []
                : [referenceLine(tokens, { value: series.target, label: copy.target })]),
            ],
          },
        },
      ],
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { color: tokens['color-border-default'], width: 1, type: 'solid' },
        },
        formatter: seriesTooltip(series.points, (entry) =>
          controlTooltip(entry, series, format, copy),
        ),
      },
    };
  }, [series, label, tokens, reducedMotion, format, copy]);

  return (
    <ChartFigure
      id={`control-${series.parameter}`}
      title={label}
      description={
        breached.length === 0
          ? copy.descriptionInSpec
              .replace('{lower}', format.decimal(series.lower_limit, 1))
              .replace('{upper}', format.decimal(series.upper_limit, 1))
              .replace('{unit}', series.unit)
          : copy.descriptionBreached
              .replace('{count}', format.count(breached.length))
              .replace('{total}', format.count(series.points.length))
      }
      showTableLabel={t.dashboard.showTable}
      tableCaption={copy.tableCaption.replace('{parameter}', label)}
      chart={<EChart option={option} height="14rem" />}
      table={
        <>
          <thead>
            <tr className="border-border-default border-b">
              <th scope="col" className="py-2 pe-4 text-start font-medium">
                {copy.columnDate}
              </th>
              <th scope="col" className="py-2 pe-4 text-end font-medium">
                {copy.columnValue.replace('{unit}', series.unit)}
              </th>
              <th scope="col" className="py-2 text-start font-medium">
                {copy.columnVerdict}
              </th>
            </tr>
          </thead>
          <tbody>
            {series.points.map((point) => {
              const failed = breaches(point.value, series);
              return (
                <tr key={point.started_at} className="border-border-default border-b">
                  <th scope="row" className="py-2 pe-4 text-start font-normal">
                    {format.fullDate(point.started_at)}
                  </th>
                  <td className="py-2 pe-4 text-end tabular-nums">
                    {format.decimal(point.value, 1)}
                  </td>
                  {/*
                   * The verdict as a word, in the table, for every row. This is
                   * what makes the red marker on the drawing a redundant second
                   * encoding rather than the only one.
                   */}
                  <td className="py-2">{failed ? copy.outOfSpec : copy.inSpec}</td>
                </tr>
              );
            })}
          </tbody>
        </>
      }
    />
  );
}
