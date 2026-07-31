import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
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
    <>
      <SiteHeader locale={locale} />
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]">
          {t.legal.privacyTitle}
        </h1>
        <p className="text-text-muted mt-4 text-[length:var(--type-ui-size-sm)]">
          {t.legal.privacyNote}
        </p>

        <div className="mt-10 flex flex-col gap-10 text-[length:var(--type-prose-size-md)] leading-(--type-prose-leading)">
          <section>
            <h2 className="font-medium">{c.controllerTitle}</h2>
            <address className="mt-2 not-italic">
              Beff GmbH
              <br />
              Musterstraße 1, 70173 Stuttgart, Deutschland
              <br />
              <a href="mailto:datenschutz@example.invalid" className="underline underline-offset-4">
                datenschutz@example.invalid
              </a>
            </address>
          </section>

          <section>
            <h2 className="font-medium">{c.processingTitle}</h2>
            {/* Scrolls inside its own container — the page body must never
                scroll sideways, and German column headings are long. */}
            <div className="mt-4 overflow-x-auto">
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
          </section>

          <section>
            <h2 className="font-medium">{c.rightsTitle}</h2>
            <ul className="mt-2 flex list-disc flex-col gap-2 ps-5">
              {c.rights.map((right) => (
                <li key={right}>{right}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-medium">{c.noTrackingTitle}</h2>
            <p className="mt-2">{c.noTrackingBody}</p>
          </section>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
