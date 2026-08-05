import { cx } from '@beff/ui/cx';
import { Eyebrow } from '@beff/ui/eyebrow';
import { Lede } from '@beff/ui/lede';

import { ChartViews } from '@beff/ui/chart-figure';
import { FIGURE_IDS } from '@/constants/figures';
import { formatters } from '@/lib/format';
import { getDictionary, translate, type Locale } from '@/lib/i18n';
import { committedValueCurve, PROCESS_STEPS } from '@/lib/metrics';

/** Plot geometry. A viewBox rather than pixels, so one drawing serves every width. */
const VIEW = { width: 1200, height: 420, top: 30, bottom: 390 } as const;
const COLUMN = VIEW.width / PROCESS_STEPS.length;

/** Where a committed-value percentage lands vertically. */
function y(pct: number): number {
  return VIEW.bottom - (pct / 100) * (VIEW.bottom - VIEW.top);
}

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
  const format = formatters(locale);

  // The stepped outline: a flat run across each step at its own height.
  const outline = committedValueCurve
    .flatMap(({ pct }, index) => [
      `${index === 0 ? 'M' : 'L'} ${String(index * COLUMN)} ${String(y(pct))}`,
      `L ${String((index + 1) * COLUMN)} ${String(y(pct))}`,
    ])
    .join(' ');

  // The two steps the copy argues from, annotated on the drawing itself.
  const annotated = (['coating', 'formation'] as const)
    .map((step) => {
      const index = PROCESS_STEPS.indexOf(step);
      const pct = committedValueCurve[index]!.pct;
      return {
        step,
        pct,
        // Percentages, so the annotation tracks the drawing at every width.
        x: ((index + 0.5) * COLUMN * 100) / VIEW.width,
        yPct: (y(pct) * 100) / VIEW.height,
      };
    })
    .map((annotation) => ({
      ...annotation,
      // Past halfway the label has to hang back off its point, or a long German
      // step name runs off the end of the figure at exactly the widths where the
      // annotations first appear.
      flip: annotation.x > 50,
    }));

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
          <>
            <div className="relative">
              <svg
                aria-hidden="true"
                viewBox={`0 0 ${String(VIEW.width)} ${String(VIEW.height)}`}
                className="block h-auto w-full"
              >
                {/* Step boundaries — the calibration marks the whole design is built from. */}
                {PROCESS_STEPS.map((step, index) => (
                  <line
                    key={step}
                    x1={index * COLUMN}
                    x2={index * COLUMN}
                    y1={VIEW.top}
                    y2={VIEW.bottom}
                    // Same token as the page's calibration ground, for the same
                    // reason: it is one step off the surface in both themes, where the
                    // border token is deliberately light in dark and would shout.
                    stroke="var(--color-surface-sunken)"
                    strokeWidth="1"
                  />
                ))}

                {/* The finished cell: the ceiling everything accrues towards. */}
                <line
                  x1="0"
                  x2={VIEW.width}
                  y1={VIEW.top}
                  y2={VIEW.top}
                  stroke="var(--color-border-default)"
                  strokeDasharray="2 6"
                  strokeWidth="1"
                />

                <path
                  d={`${outline} L ${String(VIEW.width)} ${String(VIEW.bottom)} L 0 ${String(VIEW.bottom)} Z`}
                  fill="var(--color-band-track)"
                />
                <path d={outline} fill="none" stroke="var(--color-band-range)" strokeWidth="3" />

                {/* The baseline. A cell at zero has had nothing put into it yet. */}
                <line
                  x1="0"
                  x2={VIEW.width}
                  y1={VIEW.bottom}
                  y2={VIEW.bottom}
                  stroke="var(--color-band-tick)"
                  strokeWidth="2"
                />

                {annotated.map(({ step, pct }) => (
                  <circle
                    key={step}
                    cx={(PROCESS_STEPS.indexOf(step) + 0.5) * COLUMN}
                    cy={y(pct)}
                    r="6"
                    fill="var(--color-band-tick)"
                  />
                ))}
              </svg>

              {/*
               * Annotations in HTML rather than SVG `<text>`: real type, real tokens,
               * selectable, and they wrap. SVG text scales with the drawing, which at
               * mobile widths would set the labels at about six pixels.
               */}
              {annotated.map(({ step, pct, x, yPct, flip }) => (
                <p
                  key={step}
                  className={cx(
                    'text-text-default absolute hidden max-w-40 -translate-y-full pb-3 font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tabular-nums md:block',
                    flip ? '-translate-x-full pe-3 text-end' : 'ps-3',
                  )}
                  style={{ insetInlineStart: `${String(x)}%`, top: `${String(yPct)}%` }}
                >
                  {format.percentWhole(pct)} · {translate(steps, step)}
                </p>
              ))}
            </div>

            {/* The axis: twelve ordinals, and what the two ends of the chain mean. */}
            <div aria-hidden="true" className="flex flex-col gap-2">
              <ol className="grid grid-cols-12">
                {PROCESS_STEPS.map((step, index) => (
                  <li
                    key={step}
                    className="text-text-muted border-border-default border-t pt-2 text-center font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tabular-nums"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </li>
                ))}
              </ol>
              <Eyebrow as="div" className="flex justify-between">
                <span>{t.landing.costAxisStart}</span>
                <span>{t.landing.costAxisEnd}</span>
              </Eyebrow>
            </div>
          </>
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
