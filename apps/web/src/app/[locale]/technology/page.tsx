import { Display } from '@beff/ui/display';
import { Eyebrow } from '@beff/ui/eyebrow';
import { Lede } from '@beff/ui/lede';

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
  return { title: `${c.eyebrow} - Beff`, description: c.lede };
}

/**
 * Technology.
 *
 * Three stages, numbered, each anchored to a real process step via
 * `ChainMarker` - the same component and the same `PROCESS_STEPS` source the
 * landing page and the dashboard use. The page therefore inherits its structure
 * from the production chain rather than inventing a parallel one, which is the
 * whole reason the ordinals are allowed to exist.
 *
 * It closes on what is *not* built. A technology page that only lists
 * capabilities is the easiest page on any site to disbelieve, and this product
 * is pre-launch - the reader already knows there are gaps, so naming them is
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
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <Display as="h1" size="3xl" balance className="mt-6 max-w-4xl">
            {c.title}
          </Display>
          <Lede className="mt-6">{c.lede}</Lede>
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
                <Display as="h2" balance>
                  {stage.title}
                </Display>
                <div className="flex flex-col gap-6">
                  <Lede>{stage.body}</Lede>
                  <ul className="flex flex-col gap-4">
                    {stage.detail.map((line) => (
                      <Lede
                        as="li"
                        key={line}
                        size="sm"
                        className="border-border-default border-t pt-4"
                      >
                        {line}
                      </Lede>
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
              <Display as="h2" balance>
                {c.builtTitle}
              </Display>
              <div className="flex flex-col gap-6">
                <Lede>{c.builtBody}</Lede>
                <ul className="flex flex-col gap-4">
                  {c.builtPoints.map((point) => (
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

            <div className="mt-16 grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
              <Display as="h2" balance>
                {c.notBuiltTitle}
              </Display>
              <ul className="flex flex-col gap-4">
                {c.notBuiltPoints.map((point) => (
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
      </main>

      <SiteFooter locale={locale} />
    </>
  );
}
