'use client';

import { useMemo } from 'react';

import {
  baseOption,
  categoryAxis,
  useChartTokens,
  useReducedMotion,
  valueAxis,
  type EChartsOption,
} from '@beff/ui/chart';
import { ChartViews } from '@beff/ui/chart-figure';
import { EChart } from '@beff/ui/echart';
import { Eyebrow } from '@beff/ui/eyebrow';
import { Lede } from '@beff/ui/lede';

import { FIGURE_IDS } from '@/constants/figures';
import { formatters } from '@/lib/format';
import { getDictionary, translate, type Locale } from '@/lib/i18n';
import { committedValueCurve, PROCESS_STEPS } from '@/lib/metrics';

/** The two steps the body copy argues from, marked on the drawing itself. */
const ANNOTATED = ['coating', 'formation'] as const;

/**
 * ## The cost of position, drawn
 *
 * The product's thesis is that position in the chain determines what a loss
 * costs. That is a shape, not a paragraph, and it is the one thing this page
 * has to communicate before anything else earns attention.
 *
 * ### Why a stepped area and not a bar chart
 *
 * Committed value is not twelve independent quantities to compare — it is one
 * quantity accumulating, and it only ever goes up. A stepped area says
 * "accumulating" in a way twelve separate bars do not, and it leaves the
 * comparison of *rates* to the dashboard's scrap chart, which is a different
 * question asked on a different screen. Two figures, one idea each.
 *
 * ### Why it is ECharts and not the hand-drawn SVG it used to be
 *
 * It was a `viewBox` and a `d` string built by hand, which was genuinely cheaper
 * — a server component, no JavaScript on a statically generated page. What it
 * could not do was agree with the rest of the product: the step boundaries, the
 * ceiling and the baseline were three stroke colours chosen here, beside four
 * charts whose equivalents are chosen in `@beff/ui/chart`. This page now pays a
 * client boundary for that consistency, which is the trade the conversion was
 * asked for.
 *
 * One thing genuinely improved in the move. The annotations used to be HTML
 * positioned over the drawing, because SVG `<text>` inside a `viewBox` scales
 * with the drawing and would have set the labels at roughly six pixels on a
 * phone. ECharts renders at the element's real pixel size and resizes rather
 * than scaling, so `markPoint` labels are 11px everywhere and the overlay — with
 * its own flip-past-halfway rule — is gone.
 *
 * ### Accessibility
 *
 * The drawing is `aria-hidden`. What a screen reader gets is the caption's
 * description — the shape stated in words — and the table, which carries every
 * number. Same inversion as `ScrapChart`: the table is the authoritative
 * rendering and the drawing is a fast index into it, so the two cannot drift
 * apart because there is only one source of figures.
 */
export function CostOfPosition({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const steps = t.dashboard.steps;
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const format = useMemo(() => formatters(locale), [locale]);

  const option = useMemo<EChartsOption>(() => {
    const base = baseOption({ tokens, reducedMotion });

    return {
      ...base,
      grid: { ...base.grid, top: 32, left: 0, right: 0, bottom: 0 },
      tooltip: { show: false },
      xAxis: categoryAxis(tokens, {
        // The ordinals, not the step names. Twelve German process names under a
        // horizontal axis is unreadable at any width, and the names are already
        // in the table and on the two annotations that matter.
        data: PROCESS_STEPS.map((_, index) => String(index + 1).padStart(2, '0')),
        boundaryGap: false,
        // The baseline. A cell at zero has had nothing put into it yet, so this
        // is a real edge of the figure rather than axis furniture — heavier than
        // the hairline `categoryAxis` gives every other chart.
        axisLine: { lineStyle: { color: tokens['color-band-tick'], width: 2 } },
        // Step boundaries — the calibration marks the whole page is built from.
        // The same token as the page's calibration ground: one step off the
        // surface in both themes, where `border-default` is deliberately light
        // in dark and would shout.
        splitLine: { show: true, lineStyle: { color: tokens['color-surface-sunken'], width: 1 } },
      }),
      yAxis: valueAxis(tokens, {
        min: 0,
        max: 100,
        // No value axis. The figure's claim is the *shape* — it accumulates, and
        // it accumulates late — and the two annotated points carry the only two
        // numbers the copy argues from. A per-cent axis beside them would invite
        // reading a precision this curve does not have.
        show: false,
      }),
      series: [
        {
          type: 'line',
          // `end`: the value holds across its own step and rises at the
          // boundary. `start` would draw each step's cost as already committed
          // before the step ran, which is the opposite of the argument.
          step: 'end',
          symbol: 'none',
          data: committedValueCurve.map(({ pct }) => pct),
          lineStyle: { color: tokens['color-band-range'], width: 3 },
          areaStyle: { color: tokens['color-band-track'] },
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            label: { show: false },
            // The finished cell: the ceiling everything accrues towards. Dashed,
            // like every other reference line in the product — it is a rule the
            // data is judged against, not a measurement.
            data: [
              {
                yAxis: 100,
                lineStyle: {
                  color: tokens['color-border-default'],
                  type: 'dashed',
                  width: 1,
                },
              },
            ],
          },
          markPoint: {
            silent: true,
            symbol: 'circle',
            symbolSize: 12,
            itemStyle: { color: tokens['color-band-tick'] },
            data: ANNOTATED.map((step) => {
              const index = PROCESS_STEPS.indexOf(step);
              const pct = committedValueCurve[index]?.pct ?? 0;

              return {
                // Required by `MarkPointDataItemOption`. Never rendered — the
                // label below carries the text — but it is the step's own key,
                // not a display string, so it cannot become an untranslated
                // label if ECharts ever decides to show it.
                name: step,
                coord: [index, pct] as [number, number],
                label: {
                  show: true,
                  // Past halfway the label has to hang back off its point, or a
                  // long German step name runs off the end of the figure.
                  position: index > PROCESS_STEPS.length / 2 ? 'left' : 'right',
                  distance: 8,
                  color: tokens['color-text-default'],
                  fontSize: 11,
                  formatter: `${format.percentWhole(pct)} · ${translate(steps, step)}`,
                },
              };
            }),
          },
        },
      ],
    };
  }, [tokens, reducedMotion, format, steps]);

  return (
    <figure className="grid grid-cols-1 items-start gap-6 sm:grid-cols-[1fr_auto]">
      <figcaption className="flex flex-col gap-2">
        <Eyebrow as="span" id={FIGURE_IDS.costOfPosition}>
          {t.landing.costFigureLabel}
        </Eyebrow>
        <Lede as="span" size="sm">
          {t.landing.costFigureDescription}
        </Lede>
      </figcaption>

      <ChartViews
        id={`${FIGURE_IDS.costOfPosition}-views`}
        labelledBy={FIGURE_IDS.costOfPosition}
        viewChartLabel={t.dashboard.table.viewChart}
        viewTableLabel={t.dashboard.table.viewTable}
        chart={
          <div className="flex flex-col gap-2">
            <EChart option={option} height="26rem" />

            {/* What the two ends of the chain mean. Copy, not axis labels. */}
            <Eyebrow as="div" className="flex justify-between" aria-hidden="true">
              <span>{t.landing.costAxisStart}</span>
              <span>{t.landing.costAxisEnd}</span>
            </Eyebrow>
          </div>
        }
        table={
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[length:var(--type-ui-size-sm)]">
              <caption className="text-text-muted pb-3 text-start">
                {t.landing.costTableCaption}
              </caption>
              <thead>
                <tr className="border-border-default border-b">
                  <th scope="col" className="py-2 pe-4 text-start font-medium">
                    {t.landing.costColumnStep}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t.landing.costColumnCommitted}
                  </th>
                </tr>
              </thead>
              <tbody>
                {committedValueCurve.map(({ step, pct }) => (
                  <tr key={step} className="border-border-default border-b">
                    <th scope="row" className="py-2 pe-4 text-start font-normal">
                      {translate(steps, step)}
                    </th>
                    <td className="py-2 text-end tabular-nums">{format.percentWhole(pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      />
    </figure>
  );
}
