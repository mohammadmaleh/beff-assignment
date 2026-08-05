import { Display } from '@beff/ui/display';
import { Eyebrow } from '@beff/ui/eyebrow';
import { Lede } from '@beff/ui/lede';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CompanyFilm } from '@/components/CompanyFilm';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getDictionary, isLocale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).about.title,
    description: getDictionary(locale).about.lede,
  };
}

/**
 * About.
 *
 * ## Why it does not use `LegalShell`
 *
 * This is a pitch surface, not a document. It takes the landing page's band
 * composition — full-width sections, a wide display heading against a narrower
 * measure — rather than the single 65-character column the legal pages use.
 * Setting it like an Impressum would say "this is boilerplate you may skip",
 * which is the opposite of what an About page is for.
 *
 * ## Why the content is what it is
 *
 * Everything factual here — Stuttgart and Tokyo, founders out of the lithium-ion
 * industry, the ~40 years of production experience — is Beff's own material.
 * The alternative was inventing a company history, which on a page whose entire
 * pitch is *we have stood on a line* would be the one lie the reader is best
 * equipped to catch.
 *
 * The pre-launch paragraph is load-bearing and stays. An About page that
 * implies a shipping product, on a site whose landing page says the opposite,
 * reads as either careless or evasive.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} />

      <main id="main">
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-20">
          <Eyebrow>{t.about.eyebrow}</Eyebrow>
          <Display as="h1" size="3xl" balance className="mt-6 max-w-4xl">
            {t.about.title}
          </Display>
          <Lede className="mt-6">{t.about.lede}</Lede>
        </section>

        <section className="calibration-ground border-border-default border-t">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[2fr_3fr] lg:gap-16 lg:py-24">
            <Display as="h2" balance>
              {t.about.originTitle}
            </Display>
            <div className="flex flex-col gap-4">
              <Lede>{t.about.originBody}</Lede>
              <Lede>{t.about.originBodyTwo}</Lede>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <Display as="h2" balance>
              {t.about.whereTitle}
            </Display>
            {/*
             * A description list, not a table and not two cards. Two
             * place-to-role pairs is exactly what <dl> is for, and it gives a
             * screen reader the association for free.
             */}
            <dl className="flex flex-col gap-6">
              <div className="border-border-default flex flex-col gap-1 border-t pt-4">
                <dt className="font-(family-name:--type-family-data) text-[length:var(--type-ui-size-sm)]">
                  {t.about.stuttgart}
                </dt>
                <dd className="text-text-muted text-[length:var(--type-ui-size-sm)]">
                  {t.about.stuttgartRole}
                </dd>
              </div>
              <div className="border-border-default flex flex-col gap-1 border-t pt-4">
                <dt className="font-(family-name:--type-family-data) text-[length:var(--type-ui-size-sm)]">
                  {t.about.tokyo}
                </dt>
                <dd className="text-text-muted text-[length:var(--type-ui-size-sm)]">
                  {t.about.tokyoRole}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="calibration-ground border-border-default border-t">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[2fr_3fr] lg:gap-16 lg:py-24">
            <Display as="h2" balance>
              {t.about.prelaunchTitle}
            </Display>
            <Lede>{t.about.prelaunchBody}</Lede>
          </div>
        </section>

        <CompanyFilm locale={locale} />
      </main>

      <SiteFooter locale={locale} />
    </>
  );
}
