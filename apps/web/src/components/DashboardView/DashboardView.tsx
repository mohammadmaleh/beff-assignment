'use client';

import { useQuery } from '@tanstack/react-query';

import type { ReactNode } from 'react';

import { DataState } from '@beff/ui/data-state';
import { Display } from '@beff/ui/display';
import { InfoHint } from '@beff/ui/info-hint';
import { Metric } from '@beff/ui/metric';
import { SpecBand } from '@beff/ui/spec-band';

import { AttentionPanel } from '@/components/AttentionPanel';
import { ControlChart } from '@/components/ControlChart';
import { CostTrendChart } from '@/components/CostTrendChart';
import { KpiRow } from '@/components/KpiRow';
import { ScrapChart } from '@/components/ScrapChart';
import { ScrapCostChart } from '@/components/ScrapCostChart';
import { ThroughputChart } from '@/components/ThroughputChart';
import { YieldDistributionChart } from '@/components/YieldDistributionChart';
import { YieldTrendChart } from '@/components/YieldTrendChart';
import { METRICS_ROUTES } from '@/constants/api';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { CO2_INTENSITY, PERCENT } from '@/constants/units';
import { authFetch } from '@/lib/auth';
import { formatters } from '@/lib/format';
import { getDictionary, translate, type Locale } from '@/lib/i18n';
import {
  deltaTrend,
  HEADLINE_WINDOWS,
  PROCESS_STEPS,
  yieldWindow,
  type MetricsOverview,
  type MetricsTrend,
} from '@/lib/metrics';

/**
 * The measure every band on this surface uses.
 *
 * Wider than the marketing pages' `max-w-6xl`, and deliberately so. A landing
 * page is prose and prose has an optimal measure; a dashboard is instruments,
 * and an instrument panel constrained to a reading width leaves a third of a
 * 1920px screen empty while two charts fight over the middle. The padding grows
 * with the viewport rather than the content floating in a fixed column.
 */
const BAND = 'mx-auto w-full max-w-[100rem] px-6 lg:px-10';

/**
 * A section's title, with its explanation an icon away.
 *
 * The `InfoHint` is a **sibling** of the heading, never a child. Inside it, the
 * button's own accessible name would be concatenated into the heading's, and
 * every `getByRole('region', { name })` on this page addresses a section by
 * exactly that heading text.
 */
function SectionHeading({
  id,
  title,
  hint,
  hintLabel,
}: {
  id: string;
  title: string;
  hint: ReactNode;
  hintLabel: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Display as="h2" balance id={id}>
        {title}
      </Display>
      <InfoHint label={hintLabel}>{hint}</InfoHint>
    </div>
  );
}

/**
 * The daily surface. A process engineer arrives with one question — where did
 * yield go — so the exceptions come first, the movement second, and the
 * readings that answer "how bad" immediately after.
 *
 * ## Composition
 *
 * Full-bleed bands with their own inner measure, the same device the landing
 * page uses. Previously this was one column at one width stacked six times,
 * which is precisely the shape that made the old marketing page read as a
 * document.
 *
 * ## Why there are no paragraphs under the headings
 *
 * There used to be: a `Lede` beside every `h2`, in a `2fr_3fr` grid, so three
 * fifths of the widest space on the page was prose. The people who use this
 * screen every morning know what first-pass yield is — the explanation was
 * being paid for by the reader who needed it least, and it was competing with
 * the charts for exactly the width the charts wanted.
 *
 * It is all still here, behind `InfoHint`: on hover, on focus, and in the
 * accessibility tree unconditionally. Nothing was deleted; it stopped being the
 * default view. What replaced it is more instruments — the distribution and the
 * cumulative cost curve, both built from fields that were already in the
 * payload and drawn by nothing.
 *
 * ## Why yield is a band and scrap rate is not
 *
 * The product's whole thesis is that a value alone is meaningless and a value
 * against its band is the answer. First-pass yield and capacity retention are
 * drawn against real limits. Scrap rate and CO₂ intensity are not, because they
 * have none — see `lib/metrics/windows.ts`. Banding all four would look
 * consistent and be a lie about two of them.
 */
export function DashboardView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  const { data, status } = useQuery({
    queryKey: QUERY_KEYS.metricsOverview,
    queryFn: () => authFetch<MetricsOverview>(METRICS_ROUTES.overview),
  });

  /*
   * A second query, fired in parallel rather than chained.
   *
   * The overview is four numbers and twelve rows; the trend is sixty batches
   * and their measurements. Putting them in one payload would make the headline
   * — the thing the reader came for — wait on data it does not use. Two queries
   * means the top of the page paints as soon as the small response lands.
   *
   * It has its own status because it has its own failure. A trend that fails
   * must not blank the headline figures that already arrived; the charts render
   * only when their data is there, and the rest of the page is unaffected.
   */
  const trend = useQuery({
    queryKey: QUERY_KEYS.metricsTrend,
    queryFn: () => authFetch<MetricsTrend>(METRICS_ROUTES.trend),
  });

  const format = formatters(locale);
  const hintLabel = (section: string): string =>
    t.dashboard.sectionHint.replace('{section}', section);

  return (
    <>
      <section className={`${BAND} pt-10 pb-8`}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Display as="h1">{t.dashboard.title}</Display>
          <p className="text-text-muted">
            {t.dashboard.subtitle}
            {data === undefined ? '' : ` — ${data.line_name}`}
          </p>
        </div>

        {/*
         * The masthead carries two things side by side: what the window was
         * worth, and what is currently wrong.
         *
         * They are the two questions a reader has before they have looked at
         * anything, and neither used to be answerable without scrolling the
         * whole page. The exceptions panel is the narrower column because it is
         * a list of sentences; the figures are wider because they are figures.
         */}
        {data === undefined && trend.data === undefined ? null : (
          <div className="border-border-default mt-8 grid gap-8 border-t pt-8 xl:grid-cols-[3fr_2fr] xl:gap-16">
            {trend.data === undefined ? <div /> : <KpiRow trend={trend.data} locale={locale} />}
            {data === undefined ? null : (
              <AttentionPanel overview={data} trend={trend.data} locale={locale} />
            )}
          </div>
        )}
      </section>

      {/*
       * "How it got here" — the four charts that need a series rather than a
       * reading. Gated on the trend query alone, so a slow or failed trend
       * leaves the masthead above intact rather than blanking the page.
       */}
      {trend.data === undefined || trend.data.points.length === 0 ? null : (
        <section aria-labelledby="trend" className="border-border-default border-t">
          <div className={`${BAND} py-10 lg:py-14`}>
            <SectionHeading
              id="trend"
              title={t.dashboard.charts.trendTitle}
              hint={t.dashboard.charts.trendBody}
              hintLabel={hintLabel(t.dashboard.charts.trendTitle)}
            />

            {/*
             * Two by two from `lg`, one column below it. The top row shares an
             * x-axis of the same sixty batches, so the reader can carry a
             * position across from one chart to the other — which is the whole
             * reason throughput is a separate chart rather than a second y-axis
             * on the first. The bottom row asks those same batches two
             * different questions: how they are distributed, and what they cost.
             */}
            <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-x-16">
              <YieldTrendChart
                points={trend.data.points}
                benchmark={trend.data.benchmark}
                lineKind={trend.data.line_kind}
                locale={locale}
              />
              <ThroughputChart points={trend.data.points} locale={locale} />
              <YieldDistributionChart
                points={trend.data.points}
                benchmark={trend.data.benchmark}
                lineKind={trend.data.line_kind}
                locale={locale}
              />
              <CostTrendChart points={trend.data.points} locale={locale} />
            </div>
          </div>
        </section>
      )}

      <section className={`${BAND} border-border-default border-t py-10 lg:py-14`}>
        <DataState
          status={status === 'pending' ? 'loading' : status === 'error' ? 'error' : 'ready'}
          empty={data !== undefined && data.scrap_by_step.length === 0}
          loadingLabel={t.dashboard.loading}
          errorTitle={t.dashboard.errorTitle}
          emptyTitle={t.dashboard.emptyTitle}
          emptyBody={<p>{t.dashboard.emptyBody}</p>}
          alertPrefixes={t.a11y.alertPrefixes}
        >
          {data === undefined ? null : (
            <section aria-labelledby="headline-metrics">
              {/*
               * A real heading, not an `sr-only` one.
               *
               * It used to be visually hidden and to repeat the page title,
               * which was defensible while this band opened the page — the h1
               * directly above it was the heading. Once the charts moved in
               * front, two things broke at once: a screen reader announced
               * "Production overview" twice with unrelated content under the
               * second, and sighted readers got a bare strip of figures wedged
               * between two titled bands with nothing saying what it was.
               */}
              <SectionHeading
                id="headline-metrics"
                title={t.dashboard.readingsTitle}
                hint={t.dashboard.readingsBody}
                hintLabel={hintLabel(t.dashboard.readingsTitle)}
              />

              {/*
               * All four readings on one row from `xl`, where there is width
               * for it. The two with limits keep their bands and the two
               * without keep their tiles, so the hierarchy still says which
               * readings carry a verdict — it is stated by the instrument now
               * rather than by a horizontal rule between two groups.
               */}
              <div className="mt-10 grid gap-10 sm:grid-cols-2 xl:grid-cols-4 xl:gap-x-12">
                <div className="flex flex-col gap-2">
                  <SpecBand
                    label={t.dashboard.metrics.fpy}
                    words={t.a11y.specBand}
                    value={data.first_pass_yield_pct}
                    unit={PERCENT}
                    {...yieldWindow(data.line_kind)}
                  />
                  {/*
                   * The band says where the reading sits; this says which way
                   * it is moving. Both are real information and the band
                   * replacing the old tile must not quietly drop one.
                   *
                   * Stated as a signed number and a phrase, with no arrow and
                   * no colour: direction is already in the sign, and an arrow
                   * here would need its own spoken word to satisfy the rule
                   * that colour and glyph are never the only signal.
                   */}
                  <p className="text-text-muted text-[length:var(--type-ui-size-sm)]">
                    {`${format.percentagePoints(data.first_pass_yield_delta_pp)} ${t.dashboard.deltaNote}`}
                  </p>
                </div>

                <SpecBand
                  label={t.dashboard.metrics.retention}
                  words={t.a11y.specBand}
                  value={data.capacity_retention_pct}
                  unit={PERCENT}
                  {...HEADLINE_WINDOWS.retention}
                />

                <Metric
                  label={t.dashboard.metrics.scrap}
                  value={format.decimal(data.scrap_rate_pct)}
                  unit={PERCENT}
                  delta={format.percentagePoints(data.scrap_rate_delta_pp)}
                  trend={deltaTrend(data.scrap_rate_delta_pp)}
                  trendWords={t.a11y.trend}
                  // Falling scrap is good news; the yield band above inverts
                  // this reading for the same underlying movement.
                  intent={data.scrap_rate_delta_pp <= 0 ? 'positive' : 'negative'}
                />

                <Metric
                  label={t.dashboard.metrics.co2}
                  value={format.decimal(data.co2_intensity_kg_per_kwh)}
                  unit={CO2_INTENSITY}
                />
              </div>
            </section>
          )}
        </DataState>
      </section>

      {data === undefined || data.scrap_by_step.length === 0 ? null : (
        <>
          <section aria-labelledby="scrap-breakdown" className="border-border-default border-t">
            <div className={`${BAND} py-10 lg:py-14`}>
              <SectionHeading
                id="scrap-breakdown"
                title={t.dashboard.scrapTitle}
                hint={t.dashboard.scrapBody}
                hintLabel={hintLabel(t.dashboard.scrapTitle)}
              />

              {/*
               * Side by side from `xl`, and that adjacency is the argument.
               *
               * `ScrapChart` plots the rate and its tallest bar is coating;
               * `ScrapCostChart` plots the euros and its tallest bar is
               * formation. Stacked, a reader had to hold the first shape in
               * their head while scrolling to the second. Beside each other the
               * disagreement takes about a second to see — and that
               * disagreement is the entire product thesis.
               */}
              <div className="mt-10 grid gap-12 xl:grid-cols-2 xl:gap-x-16">
                <ScrapChart rows={data.scrap_by_step} locale={locale} order={PROCESS_STEPS} />
                <ScrapCostChart rows={data.scrap_by_step} locale={locale} />
              </div>
            </div>
          </section>

          <section aria-labelledby="spec-bands" className="border-border-default border-t">
            <div className={`${BAND} py-10 lg:py-14`}>
              <SectionHeading
                id="spec-bands"
                title={t.dashboard.bandsTitle}
                hint={t.dashboard.bandsBody}
                hintLabel={hintLabel(t.dashboard.bandsTitle)}
              />

              {/* Three columns from `xl`, so a plant with six parameters does
                  not produce a metre of scrolling down one side of the screen. */}
              <div className="mt-10 grid gap-10 lg:grid-cols-2 xl:grid-cols-3 xl:gap-x-12">
                {data.spec_bands.map((band) => (
                  <SpecBand
                    key={band.parameter}
                    // The API returns a stable key (`porosity_pct`), never a
                    // display string — the same rule as process steps, and the
                    // only way the German locale can name it in German.
                    label={translate(t.dashboard.parameters, band.parameter)}
                    words={t.a11y.specBand}
                    value={band.value}
                    lowerLimit={band.lower_limit}
                    upperLimit={band.upper_limit}
                    {...(band.target === null ? {} : { target: band.target })}
                    unit={band.unit}
                  />
                ))}
              </div>

              {/*
               * The same parameters over time.
               *
               * A band says "out of spec"; a control chart says "and it has
               * been drifting for six weeks", which is the difference between a
               * symptom and a diagnosis. They sit in the same section because
               * they are two readings of one thing — the band is today, the
               * chart is how today happened.
               *
               * Small multiples, one per parameter, each with its own scale.
               * Porosity is a percentage near 32, energy density is Wh/kg near
               * 250; three of those on one plot needs either a second y-axis or
               * a normalisation that throws away the limits. See `ControlChart`.
               */}
              {trend.data === undefined || trend.data.parameters.length === 0 ? null : (
                <div className="border-border-default mt-14 grid gap-12 border-t pt-10 lg:grid-cols-2 xl:grid-cols-3 xl:gap-x-12">
                  {trend.data.parameters.map((series) => (
                    <ControlChart
                      key={series.parameter}
                      series={series}
                      label={translate(t.dashboard.parameters, series.parameter)}
                      locale={locale}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
