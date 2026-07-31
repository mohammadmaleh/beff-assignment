import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

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
  return { title: getDictionary(locale).legal.impressumTitle };
}

/**
 * §5 DDG requires an imprint that is easily recognisable and directly
 * reachable. It is linked from every footer for that reason, and it is
 * statically generated so it is in the HTML source rather than behind
 * hydration.
 */
export default async function ImpressumPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} />
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]">
          {t.legal.impressumTitle}
        </h1>
        <p className="text-text-muted mt-4 text-[length:var(--type-ui-size-sm)]">
          {t.legal.impressumNote}
        </p>

        <div className="mt-10 flex flex-col gap-8 text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
          <section>
            <h2 className="font-medium">Angaben gemäß §5 DDG</h2>
            <address className="mt-2 not-italic">
              Beff GmbH
              <br />
              Musterstraße 1<br />
              70173 Stuttgart
              <br />
              Deutschland
            </address>
          </section>

          <section>
            <h2 className="font-medium">Vertreten durch</h2>
            <p className="mt-2">Geschäftsführung: Platzhalter</p>
          </section>

          <section>
            <h2 className="font-medium">Kontakt</h2>
            <p className="mt-2">
              E-Mail:{' '}
              <a href="mailto:kontakt@example.invalid" className="underline underline-offset-4">
                kontakt@example.invalid
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-medium">Registereintrag</h2>
            <p className="mt-2">
              Handelsregister: Platzhalter
              <br />
              Registergericht: Amtsgericht Stuttgart
              <br />
              Umsatzsteuer-ID gemäß §27a UStG: Platzhalter
            </p>
          </section>

          <section>
            <h2 className="font-medium">Verbraucherstreitbeilegung</h2>
            <p className="mt-2">
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
