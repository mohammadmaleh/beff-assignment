'use client';

import { useQuery } from '@tanstack/react-query';

import { DataState } from '@beff/ui/data-state';
import { Display } from '@beff/ui/display';
import { Lede } from '@beff/ui/lede';
import { Metric } from '@beff/ui/metric';
import { SpecBand } from '@beff/ui/spec-band';

import { ControlChart } from '@/components/ControlChart';
import { KpiRow } from '@/components/KpiRow';
import { ScrapChart } from '@/components/ScrapChart';
import { ScrapCostChart } from '@/components/ScrapCostChart';
import { ThroughputChart } from '@/components/ThroughputChart';
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
 * The daily surface. A process engineer arrives with one question — where did
 * yield go — so the reading that answers "how bad" comes first and the
 * breakdown that answers "where" comes immediately after.
 *
 * ## Composition
 *
 * Full-bleed bands with their own inner measure, the same device the landing
 * page uses. Previously this was one column at one width stacked six times,
 * which is precisely the shape that made the old marketing page read as a
 * document — and it left the right-hand 40% of a 1440px screen empty while the
 * charts crowded into the left.
 *
 * Each band pairs a wide display heading against a narrower reading column, so
 * the eye has somewhere to land and the page has tonal rhythm rather than an
 * even grey.
 *
 * ## Why yield is a band and scrap rate is not
 *
 * The product's whole thesis is that a value alone is meaningless and a value
 * against its band is the answer. The dashboard used to state that thesis and
 * then print its own headline figure as a bare number with an arrow beside it —
 * 71.8% reads as a crisis on a production line and as a good week on a pilot
 * line, and the tile could not tell you which.
 *
 * First-pass yield and capacity retention are drawn against real limits.
 * Scrap rate and CO₂ intensity are not, because they have none — see
 * `lib/metrics/windows.ts`. Banding all four would look consistent and be a lie
 * about two of them.
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

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-10">
        <Display as="h1">{t.dashboard.title}</Display>
        <p className="text-text-muted mt-2">
          {t.dashboard.subtitle}
          {data === undefined ? '' : ` — ${data.line_name}`}
        </p>

        {/*
         * Facts about the window rather than measurements of the process — a
         * total, a count, a position against peers, a batch code. None has a
         * specification window, so none is banded; see `KpiRow`.
         *
         * In the masthead rather than under the readings because it is the
         * cheapest thing on the page to read, and because it gives the charts
         * immediately below it their frame: what the window cost, and where the
         * line stands against comparable ones.
         */}
        {trend.data === undefined ? null : (
          <div className="border-border-default mt-10 border-t pt-8">
            <KpiRow trend={trend.data} locale={locale} />
          </div>
        )}
      </section>

      {/*
       * "How it got here" — the two charts that need a series rather than a
       * reading. Gated on the trend query alone, so a slow or failed trend
       * leaves the headline band above intact rather than blanking the page.
       */}
      {trend.data === undefined || trend.data.points.length === 0 ? null : (
        <section aria-labelledby="trend" className="border-border-default border-t">
          <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
            <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
              <Display as="h2" balance id="trend">
                {t.dashboard.charts.trendTitle}
              </Display>
              <Lede>{t.dashboard.charts.trendBody}</Lede>
            </div>

            {/*
             * Two columns from `lg`, one below it. Both charts share an x-axis
             * of the same sixty batches, so side by side the reader can carry a
             * position across from one to the other — which is the whole reason
             * throughput is a separate chart rather than a second y-axis on the
             * first.
             */}
            <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-x-16">
              <YieldTrendChart
                points={trend.data.points}
                benchmark={trend.data.benchmark}
                lineKind={trend.data.line_kind}
                locale={locale}
              />
              <ThroughputChart points={trend.data.points} locale={locale} />
            </div>
          </div>
        </section>
      )}

      <section className="border-border-default mx-auto max-w-6xl border-t px-6 py-12">
        <div>
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
                 * second, and sighted readers got a bare strip of figures
                 * wedged between two titled bands with nothing saying what it
                 * was. Same fix for both.
                 */}
                <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
                  <Display as="h2" balance id="headline-metrics">
                    {t.dashboard.readingsTitle}
                  </Display>
                  <Lede>{t.dashboard.readingsBody}</Lede>
                </div>

                <div className="mt-12">
                  {/*
                   * The two readings that have limits, at reading scale, against
                   * their windows — the same treatment the landing hero gives
                   * first-pass yield, because it is the same measurement.
                   */}
                  <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
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
                  </div>

                  {/*
                   * The two that do not. Kept as figures with their movement,
                   * beneath the banded pair, so the hierarchy says which readings
                   * carry a verdict and which are context.
                   */}
                  <div className="border-border-default mt-12 grid gap-8 border-t pt-8 sm:grid-cols-2 lg:gap-16">
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
                </div>
              </section>
            )}
          </DataState>
        </div>
      </section>

      {data === undefined || data.scrap_by_step.length === 0 ? null : (
        <>
          <section
            aria-labelledby="scrap-breakdown"
            className="calibration-ground border-border-default border-t"
          >
            <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
              <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
                <Display as="h2" balance id="scrap-breakdown">
                  {t.dashboard.scrapTitle}
                </Display>
                <Lede>{t.dashboard.scrapBody}</Lede>
              </div>
              {/* Full width. The chart is twelve rows against a shared axis and
                  it was previously squeezed into the left column. */}
              <div className="mt-12">
                <ScrapChart rows={data.scrap_by_step} locale={locale} order={PROCESS_STEPS} />
              </div>

              {/*
               * The same twelve steps, priced.
               *
               * `ScrapChart` above plots the rate and its tallest bar is
               * coating; this plots the euros and its tallest bar is formation.
               * The two charts disagree, and that disagreement is the product's
               * entire argument — it was already in the payload, sitting in a
               * column of a table behind a `<details>` that nobody opens.
               */}
              <div className="border-border-default mt-16 border-t pt-12">
                <ScrapCostChart rows={data.scrap_by_step} locale={locale} />
              </div>
            </div>
          </section>

          <section aria-labelledby="spec-bands" className="border-border-default border-t">
            <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
              <Display as="h2" balance id="spec-bands">
                {t.dashboard.bandsTitle}
              </Display>
              {/* Two columns from `lg`, so a plant with six parameters does not
                  produce a metre of scrolling down one side of the screen. */}
              <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-x-16">
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
                <div className="border-border-default mt-16 grid gap-12 border-t pt-12 lg:grid-cols-3 lg:gap-x-10">
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
