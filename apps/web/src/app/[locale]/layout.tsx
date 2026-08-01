import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Providers } from '@/components/Providers';
import { ThemeScript } from '@/components/ThemeScript';
import { DEFAULT_LOCALE, getDictionary, isLocale, LOCALES, type Locale } from '@/lib/i18n';

import '../globals.css';

/**
 * This is the root layout. There is deliberately no `app/layout.tsx` above it —
 * the locale has to be in the `<html lang>` attribute, and a static root layout
 * cannot know it. A screen reader picks its pronunciation from `lang`, so
 * getting it wrong makes German content read aloud in an English voice.
 */
export const dynamicParams = false;

export function generateStaticParams(): { locale: Locale }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);

  return {
    title: { default: t.meta.title, template: '%s | Beff' },
    description: t.meta.description,
    // Without this, Next emits `alternates` as **relative** hrefs. Lighthouse
    // scores that as no canonical and no valid hreflang at all, and it is right
    // to: both are defined as absolute URLs, and a crawler that has reached the
    // page from a different host has no way to resolve `/de`. The declarations
    // below looked correct and did nothing, which is the failure mode worth
    // remembering — an SEO tag is not self-verifying.
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    /*
     * A plain file in `public/`, not an `app/icon.svg` metadata route.
     *
     * The convention route needs a layout to render into, and this app
     * deliberately has no `app/layout.tsx` — the locale has to reach
     * `<html lang>`, which a static root layout cannot know. So `app/icon.svg`
     * built cleanly, emitted a `<link rel="icon">`, and then answered every
     * request for it with a `NoFallbackError` 500. Same root cause as the
     * `[...unmatched]` catch-all in the traps table.
     */
    icons: { icon: '/icon.svg' },
    // Tells a crawler these are translations of one another rather than
    // duplicate content, which is what a bare two-language site looks like.
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])),
        // Which one to serve a reader whose language matches neither. Without
        // it a crawler picks, and it tends to pick the first it indexed.
        'x-default': `/${DEFAULT_LOCALE}`,
      },
    },
    openGraph: {
      title: t.meta.title,
      description: t.meta.description,
      locale: locale === 'de' ? 'de_DE' : 'en_GB',
      type: 'website',
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        {/* First focusable element on the page, per WCAG 2.4.1. */}
        <a href="#main" className="skip-link">
          {t.nav.skipToContent}
        </a>
        {/*
         * The providers are a client boundary, but the pages inside them are
         * still server components — the landing page and both legal pages
         * prerender to static HTML with this wrapper in place. Verified by
         * grepping the built HTML, not assumed.
         */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
