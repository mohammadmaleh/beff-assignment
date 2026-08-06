import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LegalSection, LegalShell } from '@/components/LegalShell';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';

import { PRIVACY_CONTENT } from './content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).legal.privacyTitle };
}

/**
 * Art. 13 GDPR information duties.
 *
 * The processing table is the part that matters: every purpose named, with its
 * legal basis and its retention period. "We take your privacy seriously" is not
 * an Art. 13 disclosure, and a German reviewer knows the difference.
 */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const c: (typeof PRIVACY_CONTENT)[Locale] = PRIVACY_CONTENT[locale];

  return (
    <LegalShell
      locale={locale}
      lang={locale}
      title={t.legal.privacyTitle}
      note={t.legal.privacyNote}
    >
      <LegalSection id="controller" heading={c.controllerTitle}>
        <address className="not-italic">
          Beff GmbH
          <br />
          Musterstraße 1, 70173 Stuttgart, Deutschland
          <br />
          <a href="mailto:datenschutz@example.invalid" className="underline underline-offset-4">
            datenschutz@example.invalid
          </a>
        </address>
      </LegalSection>

      <LegalSection id="processing" heading={c.processingTitle}>
        {/* Scrolls inside its own container - the page body must never
                scroll sideways, and German column headings are long. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--type-ui-size-sm)]">
            <caption className="sr-only">{c.processingTitle}</caption>
            <thead>
              <tr className="border-border-default border-b text-start">
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {c.columnPurpose}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {c.columnData}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {c.columnBasis}
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  {c.columnRetention}
                </th>
              </tr>
            </thead>
            <tbody>
              {c.processing.map((row) => (
                <tr key={row.purpose} className="border-border-default border-b align-top">
                  <th scope="row" className="py-3 pe-4 text-start font-normal">
                    {row.purpose}
                  </th>
                  <td className="py-3 pe-4">{row.data}</td>
                  <td className="py-3 pe-4">{row.basis}</td>
                  <td className="py-3">{row.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="storage" heading={c.storageTitle}>
        <p>{c.storageNote}</p>
        {/* Scrolls in its own container, like the processing table. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--type-ui-size-sm)]">
            <caption className="sr-only">{c.storageTitle}</caption>
            <thead>
              <tr className="border-border-default border-b text-start">
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {c.columnName}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {c.columnKind}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {c.columnPurpose}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {c.columnDuration}
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  {c.columnCategory}
                </th>
              </tr>
            </thead>
            <tbody>
              {c.storage.map((row) => (
                <tr key={row.name} className="border-border-default border-b align-top">
                  {/* The identifier is a literal string a reader will look
                          for in their own browser storage, so it is set in the
                          data face rather than the prose one. */}
                  <th
                    scope="row"
                    className="py-3 pe-4 text-start font-(family-name:--type-family-data) font-normal"
                  >
                    {row.name}
                  </th>
                  <td className="py-3 pe-4">{row.kind}</td>
                  <td className="py-3 pe-4">{row.purpose}</td>
                  <td className="py-3 pe-4">{row.duration}</td>
                  <td className="py-3">{row.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="rights" heading={c.rightsTitle}>
        <ul className="flex list-disc flex-col gap-2 ps-5">
          {c.rights.map((right) => (
            <li key={right}>{right}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="no-tracking" heading={c.noTrackingTitle}>
        <p>{c.noTrackingBody}</p>
      </LegalSection>
    </LegalShell>
  );
}
