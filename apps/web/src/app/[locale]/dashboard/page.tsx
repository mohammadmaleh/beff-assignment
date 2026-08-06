import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { DashboardView } from '@/components/DashboardView';
import { getDictionary, isLocale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).dashboard.title, robots: { index: false } };
}

/**
 * The daily surface.
 *
 * The page shell is a server component and the data is fetched client-side -
 * FastAPI owns auth, and the refresh token rotates on every use, so redeeming
 * it during SSR would spend a token on a response the browser might never
 * receive (decision #3).
 */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <AppShell locale={locale}>
      <DashboardView locale={locale} />
    </AppShell>
  );
}
