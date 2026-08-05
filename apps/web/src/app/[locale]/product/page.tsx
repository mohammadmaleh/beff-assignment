import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Display } from '@beff/ui/display';
import { Eyebrow } from '@beff/ui/eyebrow';
import { Lede } from '@beff/ui/lede';
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
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <Display as="h1" size="3xl" balance className="mt-6 max-w-4xl">
            {c.title}
          </Display>
          <Lede className="mt-6">{c.lede}</Lede>
        </section>

        <section className="calibration-ground border-border-default border-t">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
            <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
              <Display as="h2" balance>
                {c.measuresTitle}
              </Display>
              <Lede>{c.measuresBody}</Lede>
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
                  <Lede size="sm">{measurement.note}</Lede>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <Display as="h2" balance>
              {c.readingTitle}
            </Display>
            <div className="flex flex-col gap-6">
              <Lede>{c.readingBody}</Lede>
              <ul className="flex flex-col gap-4">
                {c.readingPoints.map((point) => (
                  <Lede
                    as="li"
                    key={point}
                    size="sm"
                    className="border-border-default border-t pt-4"
                  >
                    {point}
                  </Lede>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="calibration-ground border-border-default border-t">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[2fr_3fr] lg:gap-16 lg:py-24">
            <Display as="h2" balance>
              {c.honestTitle}
            </Display>
            <Lede>{c.honestBody}</Lede>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </>
  );
}
