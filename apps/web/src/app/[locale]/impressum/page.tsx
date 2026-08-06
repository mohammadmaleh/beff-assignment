import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LegalSection, LegalShell } from '@/components/LegalShell';
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
 *
 * The body stays German on the English page and is marked `lang="de"`. The §5
 * disclosure is a German legal instrument - translating it produces something
 * that is no longer the disclosure - but an English voice reading German at
 * English phonetics is WCAG 3.1.2, so the marking is not optional.
 */
export default async function ImpressumPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <LegalShell
      locale={locale}
      lang="de"
      title={t.legal.impressumTitle}
      note={t.legal.impressumNote}
    >
      <LegalSection id="provider" heading="Angaben gemäß §5 DDG">
        <address className="not-italic">
          Beff GmbH
          <br />
          Musterstraße 1<br />
          70173 Stuttgart
          <br />
          Deutschland
        </address>
      </LegalSection>

      <LegalSection id="represented-by" heading="Vertreten durch">
        <p>Geschäftsführung: Platzhalter</p>
      </LegalSection>

      <LegalSection id="contact" heading="Kontakt">
        <p>
          E-Mail:{' '}
          <a href="mailto:kontakt@example.invalid" className="underline underline-offset-4">
            kontakt@example.invalid
          </a>
        </p>
      </LegalSection>

      <LegalSection id="register" heading="Registereintrag">
        <p>
          Handelsregister: Platzhalter
          <br />
          Registergericht: Amtsgericht Stuttgart
          <br />
          Umsatzsteuer-ID gemäß §27a UStG: Platzhalter
        </p>
      </LegalSection>

      <LegalSection id="dispute-resolution" heading="Verbraucherstreitbeilegung">
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
