import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AuthForm } from '@/components/AuthForm';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getDictionary, isLocale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  // A login page has nothing to offer a search engine and everything to lose
  // from being indexed.
  return { title: getDictionary(locale).auth.loginTitle, robots: { index: false } };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} />
      <main id="main" className="mx-auto w-full max-w-md px-6 py-16">
        <h1 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]">
          {t.auth.loginTitle}
        </h1>
        <p className="text-text-muted mt-2">{t.auth.loginSubtitle}</p>

        <div className="mt-10">
          <AuthForm mode="login" locale={locale} />
        </div>

        <p className="mt-8 text-[length:var(--type-ui-size-sm)]">
          {t.auth.noAccount}{' '}
          <Link href={surfacePath('register', locale)} className="underline underline-offset-4">
            {t.auth.toRegister}
          </Link>
        </p>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
