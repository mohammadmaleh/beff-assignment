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
  return { title: getDictionary(locale).auth.registerTitle, robots: { index: false } };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} />
      <main id="main" className="mx-auto w-full max-w-md px-6 py-16">
        <h1 className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-2xl)] [font-stretch:125%]">
          {t.auth.registerTitle}
        </h1>
        <p className="text-text-muted mt-2">{t.auth.registerSubtitle}</p>

        <div className="mt-10">
          <AuthForm mode="register" locale={locale} />
        </div>

        <p className="mt-8 text-[length:var(--type-ui-size-sm)]">
          {t.auth.haveAccount}{' '}
          <Link href={surfacePath('login', locale)} className="underline underline-offset-4">
            {t.auth.toLogin}
          </Link>
        </p>

        <p className="text-text-muted mt-6 text-[length:var(--type-ui-size-sm)]">
          <Link href={surfacePath('privacy', locale)} className="underline underline-offset-4">
            {t.footer.privacy}
          </Link>
        </p>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
