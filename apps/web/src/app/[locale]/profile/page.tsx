import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { ProfileView } from '@/components/ProfileView';
import { getDictionary, isLocale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).profile.title, robots: { index: false } };
}

/**
 * Where a data subject exercises their rights.
 *
 * Consent, export and erasure live on one surface rather than behind a
 * "Settings" tree, because a right that takes three clicks to find is a right
 * that gets exercised by complaint to a supervisory authority instead.
 */
export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <AppShell locale={locale}>
      <ProfileView locale={locale} />
    </AppShell>
  );
}
