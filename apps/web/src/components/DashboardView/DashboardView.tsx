'use client';

import { useQuery } from '@tanstack/react-query';

import { DataState } from '@beff/ui/data-state';
import { Metric } from '@beff/ui/metric';
import { SpecBand } from '@beff/ui/spec-band';

import { ScrapChart } from '@/components/ScrapChart';
import { authFetch } from '@/lib/auth';
import { getDictionary, type Locale } from '@/lib/i18n';
import { HEADLINE_WINDOWS, PROCESS_STEPS, yieldWindow, type MetricsOverview } from '@/lib/metrics';

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
    queryKey: ['metrics', 'overview'],
    queryFn: () => authFetch<MetricsOverview>('/metrics/overview'),
  });

  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const signed = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });

  const trendOf = (delta: number): 'up' | 'down' | 'flat' =>
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-16">
        <h1 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]">
          {t.dashboard.title}
        </h1>
        <p className="text-text-muted mt-2">
          {t.dashboard.subtitle}
          {data === undefined ? '' : ` — ${data.line_name}`}
        </p>

        <div className="mt-10">
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
                <h2 id="headline-metrics" className="sr-only">
                  {t.dashboard.title}
                </h2>

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
                      unit="%"
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
                      {`${signed.format(data.first_pass_yield_delta_pp)} pp ${t.dashboard.deltaNote}`}
                    </p>
                  </div>
                  <SpecBand
                    label={t.dashboard.metrics.retention}
                    words={t.a11y.specBand}
                    value={data.capacity_retention_pct}
                    unit="%"
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
                    value={number.format(data.scrap_rate_pct)}
                    unit="%"
                    delta={`${signed.format(data.scrap_rate_delta_pp)} pp`}
                    trend={trendOf(data.scrap_rate_delta_pp)}
                    trendWords={t.a11y.trend}
                    // Falling scrap is good news; the yield band above inverts
                    // this reading for the same underlying movement.
                    intent={data.scrap_rate_delta_pp <= 0 ? 'positive' : 'negative'}
                  />
                  <Metric
                    label={t.dashboard.metrics.co2}
                    value={number.format(data.co2_intensity_kg_per_kwh)}
                    unit="kg CO₂e/kWh"
                  />
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
            <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
              <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
                <h2
                  id="scrap-breakdown"
                  className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] leading-[1.05] text-balance [font-stretch:125%]"
                >
                  {t.dashboard.scrapTitle}
                </h2>
                <p className="text-text-muted max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
                  {t.dashboard.scrapBody}
                </p>
              </div>
              {/* Full width. The chart is twelve rows against a shared axis and
                  it was previously squeezed into the left column. */}
              <div className="mt-12">
                <ScrapChart rows={data.scrap_by_step} locale={locale} order={PROCESS_STEPS} />
              </div>
            </div>
          </section>

          <section aria-labelledby="spec-bands" className="border-border-default border-t">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
              <h2
                id="spec-bands"
                className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] leading-[1.05] text-balance [font-stretch:125%]"
              >
                {t.dashboard.bandsTitle}
              </h2>
              {/* Two columns from `lg`, so a plant with six parameters does not
                  produce a metre of scrolling down one side of the screen. */}
              <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-x-16">
                {data.spec_bands.map((band) => (
                  <SpecBand
                    key={band.parameter}
                    // The API returns a stable key (`porosity_pct`), never a
                    // display string — the same rule as process steps, and the
                    // only way the German locale can name it in German.
                    label={
                      (t.dashboard.parameters as Record<string, string>)[band.parameter] ??
                      band.parameter
                    }
                    words={t.a11y.specBand}
                    value={band.value}
                    lowerLimit={band.lower_limit}
                    upperLimit={band.upper_limit}
                    {...(band.target === null ? {} : { target: band.target })}
                    unit={band.unit}
                  />
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
