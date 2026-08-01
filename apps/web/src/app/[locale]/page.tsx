import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SpecBand } from '@beff/ui/spec-band';

import { CookieBanner } from '@/components/CookieBanner';
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
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} />

      <main id="main">
        <section className="mx-auto max-w-5xl px-6 py-20">
          <p className="text-text-muted text-[length:var(--type-ui-size-sm)] tracking-[0.12em] uppercase">
            {t.landing.eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl font-(family-name:--type-family-display) text-[length:var(--type-ui-size-3xl)] leading-[1.1] [font-stretch:125%]">
            {t.landing.headline}
          </h1>
          <p className="text-text-muted mt-6 max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-lg)] leading-(--type-prose-leading)">
            {t.landing.subhead}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="#waitlist"
              className="bg-brand-default text-text-on-brand rounded-chamfer hover:bg-brand-hover inline-flex items-center px-4 py-2 font-medium"
            >
              {t.landing.ctaPrimary}
            </Link>
            <Link href="#what-you-get" className="underline underline-offset-4">
              {t.landing.ctaSecondary}
            </Link>
          </div>
        </section>

        {/*
         * A rule, not a card. The design brief settled on no cards anywhere —
         * borders carry the structure a filled panel would, which is why
         * `border-default` is gated at 3:1 as load-bearing UI rather than at
         * the 1.5:1 a decorative hairline would need.
         */}
        <section className="border-border-default mx-auto max-w-5xl border-t px-6 py-16">
          <h2 className="max-w-2xl font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]">
            {t.landing.problemTitle}
          </h2>
          <p className="text-text-muted mt-4 max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
            {t.landing.problemBody}
          </p>
        </section>

        <section
          id="what-you-get"
          className="border-border-default mx-auto max-w-5xl scroll-mt-8 border-t px-6 py-16"
        >
          <h2 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]">
            {t.landing.valueTitle}
          </h2>
          <ul className="mt-8 grid gap-8 sm:grid-cols-3">
            {t.landing.values.map((value) => (
              <li key={value.title} className="flex flex-col gap-2">
                {/* The calibration mark from the brief's visual vocabulary. */}
                <span aria-hidden="true" className="bg-band-tick h-px w-8" />
                <h3 className="text-[length:var(--type-ui-size-lg)] font-medium">{value.title}</h3>
                <p className="text-text-muted text-[length:var(--type-prose-size-sm)] leading-(--type-prose-leading)">
                  {value.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border-default mx-auto max-w-5xl border-t px-6 py-16">
          <h2 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]">
            {t.landing.signatureTitle}
          </h2>
          <p className="text-text-muted mt-4 max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
            {t.landing.signatureBody}
          </p>
          {/* Porosity after calendering runs 30–35% — see CONTEXT.md. These are
              plausible numbers, not decorative ones. */}
          <div className="mt-10 flex max-w-xl flex-col gap-8">
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
        </section>

        <section
          id="waitlist"
          className="border-border-default mx-auto max-w-5xl scroll-mt-8 border-t px-6 py-16"
        >
          <h2 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]">
            {t.landing.waitlistTitle}
          </h2>
          <p className="text-text-muted mt-4 max-w-[var(--type-prose-measure)] text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
            {t.landing.waitlistBody}
          </p>
          <div className="mt-8 max-w-md">
            <WaitlistForm locale={locale} />
          </div>
          <p className="text-text-muted mt-6 max-w-[var(--type-prose-measure)] text-[length:var(--type-ui-size-sm)]">
            <Link href={surfacePath('privacy', locale)} className="underline underline-offset-4">
              {t.footer.privacy}
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter locale={locale} />
      <CookieBanner locale={locale} />
    </>
  );
}
