import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { getDictionary, isLocale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).onboarding.title, robots: { index: false } };
}

/**
 * A one-time flow, rendered without the primary navigation.
 *
 * Offering an escape hatch mid-wizard is how a half-configured account happens,
 * and a half-configured account renders an empty dashboard that teaches the
 * user the product is broken.
 */
export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <AppShell locale={locale} bare>
      <OnboardingWizard locale={locale} />
    </AppShell>
  );
}
