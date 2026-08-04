import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ChainMarker } from '@/components/ChainMarker';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { isLocale } from '@/lib/i18n';

import { TECHNOLOGY_CONTENT } from './content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = TECHNOLOGY_CONTENT[locale];
  return { title: `${c.eyebrow} — Beff`, description: c.lede };
}

/**
 * Technology.
 *
 * Three stages, numbered, each anchored to a real process step via
 * `ChainMarker` — the same component and the same `PROCESS_STEPS` source the
 * landing page and the dashboard use. The page therefore inherits its structure
 * from the production chain rather than inventing a parallel one, which is the
 * whole reason the ordinals are allowed to exist.
 *
 * It closes on what is *not* built. A technology page that only lists
 * capabilities is the easiest page on any site to disbelieve, and this product
 * is pre-launch — the reader already knows there are gaps, so naming them is
 * cheaper than being caught omitting them.
 */
export default async function TechnologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = TECHNOLOGY_CONTENT[locale];

  return (
    <>
      <SiteHeader locale={locale} />

      <main id="main">
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-20">
          <p className="text-text-muted font-(family-name:--type-family-data) text-[length:var(--type-ui-size-xs)] tracking-[0.14em] uppercase">
            {c.eyebrow}
          </p>
          <h1 className="mt-6 max-w-4xl font-(family-name:--type-family-display) text-[length:var(--type-ui-size-3xl)] leading-[1.05] text-balance [font-stretch:125%]">
            {c.title}
          </h1>
          <p className="text-text-muted mt-6 max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
            {c.lede}
          </p>
        </section>

        {c.stages.map((stage, index) => (
          <section
            key={stage.ordinal}
            className={
              index % 2 === 0
                ? 'calibration-ground border-border-default border-t'
                : 'border-border-default border-t'
            }
          >
            <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
              <ChainMarker step={stage.anchorStep} locale={locale} />
              <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
                <h2 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] leading-[1.05] text-balance [font-stretch:125%]">
                  {stage.title}
                </h2>
                <div className="flex flex-col gap-6">
                  <p className="text-text-muted max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
                    {stage.body}
                  </p>
                  <ul className="flex flex-col gap-4">
                    {stage.detail.map((line) => (
                      <li
                        key={line}
                        className="border-border-default text-text-muted max-w-[var(--type-prose-measure)] border-t pt-4 text-[length:var(--type-ui-size-sm)]"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        ))}

        <section className="border-border-default border-t">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
            <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
              <h2 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] leading-[1.05] text-balance [font-stretch:125%]">
                {c.builtTitle}
              </h2>
              <div className="flex flex-col gap-6">
                <p className="text-text-muted max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
                  {c.builtBody}
                </p>
                <ul className="flex flex-col gap-4">
                  {c.builtPoints.map((point) => (
                    <li
                      key={point}
                      className="border-border-default text-text-muted max-w-[var(--type-prose-measure)] border-t pt-4 text-[length:var(--type-ui-size-sm)]"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-16 grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
              <h2 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] leading-[1.05] text-balance [font-stretch:125%]">
                {c.notBuiltTitle}
              </h2>
              <ul className="flex flex-col gap-4">
                {c.notBuiltPoints.map((point) => (
                  <li
                    key={point}
                    className="border-border-default text-text-muted max-w-[var(--type-prose-measure)] border-t pt-4 text-[length:var(--type-ui-size-sm)]"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </>
  );
}
