import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Display } from '@beff/ui/display';
import { Lede } from '@beff/ui/lede';
import { SpecBand } from '@beff/ui/spec-band';

import { ChainMarker } from '@/components/ChainMarker';
import { CompanyFilm } from '@/components/CompanyFilm';
import { CookieBanner } from '@/components/CookieBanner';
import { CostOfPosition } from '@/components/CostOfPosition';
import { LandingHero } from '@/components/LandingHero';
import { ProductPanel } from '@/components/ProductPanel';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { WaitlistForm } from '@/components/WaitlistForm';
import { getDictionary, isLocale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

/**
 * The landing surface. Statically generated — the whole page, including the
 * German one, is in the HTML source before any JavaScript runs. That is the
 * claim behind choosing Next at all, and `curl` proves it.
 *
 * Only the waitlist form, the cookie banner and the theme toggle are client
 * components. Everything a crawler or a reader needs is server-rendered.
 *
 * ## Structure
 *
 * The production chain is the page's structure, not a metaphor laid over it:
 * every section boundary sits at a real process step, and the ordinals come from
 * `PROCESS_STEPS` rather than from a designer's sense of rhythm.
 *
 *     01  mixing          the data exists, scattered
 *     02  coating         where value is already committed  ← the argument
 *     10  formation       the product, on real figures      ← the proof
 *     12  end-of-line     the tolerance band
 *         —               the company, on film              ← who is asking
 *         —               the ask
 *
 * The last two bands carry no ordinal on purpose. They are not process steps,
 * and borrowing a number for them would be exactly the decoration the ordinals
 * exist to avoid — the markers mean "this is position N in a real sequence", or
 * they mean nothing.
 *
 * Sections are full-bleed bands with their own inner measure, so the page has
 * tonal rhythm instead of six identically-inset blocks of prose. The design
 * brief called that "the band becomes the unit of composition"; the first
 * implementation used one width and one rule six times, which is what makes a
 * page read as a document.
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} />

      <main id="main">
        <LandingHero locale={locale} />

        <section className="mx-auto max-w-6xl px-6 py-20">
          <ChainMarker step="mixing" locale={locale} />
          <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <Display as="h2" balance>
              {t.landing.problemTitle}
            </Display>
            <Lede>{t.landing.problemBody}</Lede>
          </div>
        </section>

        {/*
         * The argument, as a drawing. This is where a three-column feature grid
         * used to be — the "icon trio" the design brief ruled out, and the part
         * of the page that made it look like every other pre-launch site.
         */}
        <section
          id="cost"
          className="calibration-ground border-border-default scroll-mt-8 border-t"
        >
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
            <ChainMarker step="coating" locale={locale} />
            <div className="mt-10 flex flex-col gap-10">
              <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
                <Display as="h2" balance>
                  {t.landing.costTitle}
                </Display>
                <Lede>{t.landing.costBody}</Lede>
              </div>
              <CostOfPosition locale={locale} />
            </div>
          </div>
        </section>

        <ProductPanel locale={locale} />

        <section className="mx-auto max-w-6xl px-6 py-20">
          <ChainMarker step="eol_test" locale={locale} />
          <div className="mt-10 grid gap-12 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div className="flex flex-col gap-4">
              <Display as="h2" balance>
                {t.landing.signatureTitle}
              </Display>
              <Lede>{t.landing.signatureBody}</Lede>
            </div>

            {/*
             * The same measurement, twice: in spec, and past its upper limit.
             * Porosity after calendering runs 30–35% — see CONTEXT.md. These are
             * plausible numbers, not decorative ones.
             */}
            <div className="flex max-w-xl flex-col gap-8">
              <SpecBand
                label={t.landing.signatureExampleLabel}
                words={t.a11y.specBand}
                value={32.4}
                lowerLimit={30}
                upperLimit={35}
                target={32.5}
                unit="%"
              />
              <SpecBand
                label={t.landing.signatureExampleLabel}
                words={t.a11y.specBand}
                value={36.8}
                lowerLimit={30}
                upperLimit={35}
                target={32.5}
                unit="%"
              />
            </div>
          </div>
        </section>

        {/*
         * The argument is finished by here. What is left before the ask is
         * "who are you", which is the one question a company film answers.
         */}
        <CompanyFilm locale={locale} />

        <section
          id="waitlist"
          className="calibration-ground border-border-default scroll-mt-8 border-t"
        >
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[2fr_3fr] lg:gap-16">
              <div className="flex flex-col gap-4">
                <Display as="h2" balance>
                  {t.landing.waitlistTitle}
                </Display>
                <Lede>{t.landing.waitlistBody}</Lede>
                <p className="text-text-muted mt-2 text-[length:var(--type-ui-size-sm)]">
                  <Link
                    href={surfacePath('privacy', locale)}
                    className="underline underline-offset-4"
                  >
                    {t.footer.privacy}
                  </Link>
                </p>
              </div>
              <div className="max-w-md">
                <WaitlistForm locale={locale} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
      <CookieBanner locale={locale} />
    </>
  );
}
