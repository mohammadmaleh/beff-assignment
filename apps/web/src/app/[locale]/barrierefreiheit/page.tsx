import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LegalSection, LegalShell } from '@/components/LegalShell';
import { getDictionary, isLocale } from '@/lib/i18n';

import { ACCESSIBILITY_CONTENT } from './content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).legal.accessibilityTitle };
}

/**
 * Barrierefreiheitserklärung, per §14 BFSG.
 *
 * Translated rather than German-only, for a reason specific to this document:
 * it exists to be read by people who hit a barrier, and handing a screen-reader
 * user a German wall of text on the English site would be an accessibility
 * failure inside the accessibility statement.
 */
export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <LegalShell
      locale={locale}
      lang={locale}
      title={t.legal.accessibilityTitle}
      note={t.legal.accessibilityNote}
    >
      {ACCESSIBILITY_CONTENT[locale].map((clause) => (
        <LegalSection key={clause.id} id={clause.id} heading={clause.heading}>
          {clause.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </LegalSection>
      ))}
    </LegalShell>
  );
}
