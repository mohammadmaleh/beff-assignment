import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LegalSection, LegalShell } from '@/components/LegalShell';
import { getDictionary, isLocale } from '@/lib/i18n';

import { TERMS_CONTENT } from './content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).legal.termsTitle };
}

/**
 * Nutzungsbedingungen.
 *
 * Unlike the Impressum, this document is genuinely translated rather than German
 * everywhere: it governs a relationship with the reader, so it has to be in a
 * language they actually read. `lang` therefore follows the locale.
 */
export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <LegalShell locale={locale} lang={locale} title={t.legal.termsTitle} note={t.legal.termsNote}>
      {TERMS_CONTENT[locale].map((clause) => (
        <LegalSection key={clause.id} id={clause.id} heading={clause.heading}>
          {clause.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </LegalSection>
      ))}
    </LegalShell>
  );
}
