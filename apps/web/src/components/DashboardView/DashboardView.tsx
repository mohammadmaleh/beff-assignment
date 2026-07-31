'use client';

import { useQuery } from '@tanstack/react-query';

import { DataState } from '@beff/ui/data-state';
import { Metric } from '@beff/ui/metric';
import { SpecBand } from '@beff/ui/spec-band';

import { ScrapChart } from '@/components/ScrapChart';
import { authFetch } from '@/lib/auth';
import { getDictionary, type Locale } from '@/lib/i18n';
import { PROCESS_STEPS, type MetricsOverview } from '@/lib/metrics';

/**
 * The daily surface. A process engineer arrives with one question — where did
 * yield go — so the four headline figures come first and the breakdown that
 * answers "where" comes immediately after.
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
        >
          {data === undefined ? null : (
            <div className="flex flex-col gap-16">
              <section aria-labelledby="headline-metrics">
                <h2 id="headline-metrics" className="sr-only">
                  {t.dashboard.title}
                </h2>
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label={t.dashboard.metrics.fpy}
                    value={number.format(data.first_pass_yield_pct)}
                    unit="%"
                    delta={`${signed.format(data.first_pass_yield_delta_pp)} pp`}
                    trend={trendOf(data.first_pass_yield_delta_pp)}
                    // Yield up is good news; the next tile inverts this for
                    // exactly the same arrow.
                    intent={data.first_pass_yield_delta_pp >= 0 ? 'positive' : 'negative'}
                  />
                  <Metric
                    label={t.dashboard.metrics.scrap}
                    value={number.format(data.scrap_rate_pct)}
                    unit="%"
                    delta={`${signed.format(data.scrap_rate_delta_pp)} pp`}
                    trend={trendOf(data.scrap_rate_delta_pp)}
                    intent={data.scrap_rate_delta_pp <= 0 ? 'positive' : 'negative'}
                  />
                  <Metric
                    label={t.dashboard.metrics.retention}
                    value={number.format(data.capacity_retention_pct)}
                    unit="%"
                  />
                  <Metric
                    label={t.dashboard.metrics.co2}
                    value={number.format(data.co2_intensity_kg_per_kwh)}
                    unit="kg CO₂e/kWh"
                  />
                </div>
              </section>

              <section aria-labelledby="scrap-breakdown">
                <h2
                  id="scrap-breakdown"
                  className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-xl)] [font-stretch:125%]"
                >
                  {t.dashboard.scrapTitle}
                </h2>
                <p className="text-text-muted mt-2 max-w-[var(--type-prose-measure)] text-[length:var(--type-ui-size-sm)]">
                  {t.dashboard.scrapBody}
                </p>
                <div className="mt-8">
                  <ScrapChart rows={data.scrap_by_step} locale={locale} order={PROCESS_STEPS} />
                </div>
              </section>

              <section aria-labelledby="spec-bands">
                <h2
                  id="spec-bands"
                  className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-xl)] [font-stretch:125%]"
                >
                  {t.dashboard.bandsTitle}
                </h2>
                <div className="mt-8 flex max-w-xl flex-col gap-8">
                  {data.spec_bands.map((band) => (
                    <SpecBand
                      key={band.parameter}
                      label={band.label}
                      value={band.value}
                      lowerLimit={band.lower_limit}
                      upperLimit={band.upper_limit}
                      {...(band.target === null ? {} : { target: band.target })}
                      unit={band.unit}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </DataState>
      </div>
    </>
  );
}
