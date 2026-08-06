import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { VerifyEmailView } from '@/components/VerifyEmailView';
import { getDictionary, isLocale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).verifyEmail.pageTitle,
    // The URL carries a single-use credential. Keeping it out of an index is
    // the least of it - `noindex` also stops the page being crawled and its
    // token spent by a bot that found the link somewhere it should not be.
    robots: { index: false, follow: false },
  };
}

export default async function VerifyEmailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} />
      <main id="main">
        {/*
         * `useSearchParams` needs a Suspense boundary or the whole route opts
         * out of static generation - and the fallback is the same live region
         * the view itself shows while it works, so the two are indistinguishable
         * to a reader.
         */}
        <Suspense
          fallback={
            <div className="mx-auto w-full max-w-md px-6 py-16">
              <p role="status" aria-live="polite" className="text-text-muted">
                {t.verifyEmail.checking}
              </p>
            </div>
          }
        >
          <VerifyEmailView locale={locale} />
        </Suspense>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
