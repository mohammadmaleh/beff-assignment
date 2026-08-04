import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SpecBand } from '@beff/ui/spec-band';

import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getDictionary, isLocale } from '@/lib/i18n';

import { PRODUCT_CONTENT } from './content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = PRODUCT_CONTENT[locale];
  return { title: `${c.eyebrow} — Beff`, description: c.lede };
}

/**
 * Product.
 *
 * The page is five spec bands and the argument around them. That is deliberate:
 * the signature element appears wherever a real measurement meets a real limit,
 * so a page *about* what the product measures is the one place it belongs at
 * length. A feature list with checkmarks would describe the same thing while
 * demonstrating none of it.
 *
 * Every reading is inside the ranges in `CONTEXT.md`, including the one that is
 * deliberately out of spec — a page of five passing measurements would never
 * show what the band is for.
 */
export default async function ProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const c = PRODUCT_CONTENT[locale];

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

        <section className="calibration-ground border-border-default border-t">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
            <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
              <h2 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] leading-[1.05] text-balance [font-stretch:125%]">
                {c.measuresTitle}
              </h2>
              <p className="text-text-muted max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
                {c.measuresBody}
              </p>
            </div>

            <ul className="mt-14 flex flex-col gap-12">
              {c.measurements.map((measurement) => (
                <li
                  key={measurement.label}
                  className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-16"
                >
                  <SpecBand
                    label={measurement.label}
                    words={t.a11y.specBand}
                    value={measurement.value}
                    lowerLimit={measurement.lowerLimit}
                    upperLimit={measurement.upperLimit}
                    target={measurement.target}
                    unit={measurement.unit}
                  />
                  <p className="text-text-muted max-w-[var(--type-prose-measure)] text-[length:var(--type-ui-size-sm)]">
                    {measurement.note}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <h2 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] leading-[1.05] text-balance [font-stretch:125%]">
              {c.readingTitle}
            </h2>
            <div className="flex flex-col gap-6">
              <p className="text-text-muted max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
                {c.readingBody}
              </p>
              <ul className="flex flex-col gap-4">
                {c.readingPoints.map((point) => (
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

        <section className="calibration-ground border-border-default border-t">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[2fr_3fr] lg:gap-16 lg:py-24">
            <h2 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] leading-[1.05] text-balance [font-stretch:125%]">
              {c.honestTitle}
            </h2>
            <p className="text-text-muted max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
              {c.honestBody}
            </p>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </>
  );
}
