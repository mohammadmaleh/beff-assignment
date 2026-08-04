'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Button } from '@beff/ui/button';

import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth';
import { getDictionary, type Locale } from '@/lib/i18n';
import { primaryNav, surfacePath, type SurfaceKey } from '@/lib/navigation';

/**
 * The authenticated frame: navigation, sign-out, and the gate in front of both.
 *
 * The gate is client-side because auth is owned end to end by FastAPI and the
 * refresh token rotates on every use — redeeming it during SSR would burn a
 * token on a response the browser may never receive (decision #3). That is a
 * deliberate trade: the *security boundary* is the API, which rejects every
 * unauthenticated request regardless of what the browser renders. This redirect
 * is a navigation courtesy, not a permission check, and it is worth being
 * explicit that those are different things.
 */
export function AppShell({
  locale,
  children,
  /** Chrome-free surfaces — the onboarding wizard has no navigation by design. */
  bare = false,
}: {
  locale: Locale;
  children: ReactNode;
  bare?: boolean;
}) {
  const t = getDictionary(locale);
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && user === null) router.replace(surfacePath('login', locale));
  }, [loading, user, router, locale]);

  if (loading || user === null) {
    return (
      <main id="main" className="mx-auto max-w-5xl px-6 py-16">
        {/* A live region rather than a bare spinner: the wait is announced. */}
        <p role="status" aria-live="polite" className="text-text-muted">
          {t.common.loading}
        </p>
      </main>
    );
  }

  const label: Record<SurfaceKey, string> = {
    dashboard: t.nav.dashboard,
    profile: t.nav.profile,
    landing: 'Beff',
    product: t.nav.product,
    technology: t.nav.technology,
    about: t.footer.about,
    impressum: t.footer.impressum,
    privacy: t.footer.privacy,
    terms: t.footer.terms,
    accessibility: t.footer.accessibility,
    login: t.nav.logIn,
    register: t.nav.getStarted,
    onboarding: t.onboarding.title,
  };

  return (
    <>
      {bare ? null : (
        /*
         * The same header as the marketing surface, deliberately. It used to be
         * a different product: `Beff` set in Archivo instead of the wordmark,
         * `max-w-5xl` against the marketing `6xl`, and nav links that were
         * underlined at the same weight as everything beside them. A reader who
         * signs in should not feel they have left the site they signed in to.
         */
        <header className="border-border-default border-b">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-6 py-4">
            <Link
              href={surfacePath('dashboard', locale)}
              className="inline-flex items-center rounded-xs"
            >
              <BrandMark className="h-6" />
            </Link>

            <nav aria-label={t.nav.primary}>
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {primaryNav.map((surface) => {
                  const href = surfacePath(surface.key, locale);
                  const current = pathname === href;
                  return (
                    <li key={surface.key}>
                      <Link
                        href={href}
                        // `aria-current` is what tells a screen reader which
                        // item is the current page. The underline alone says
                        // it to sighted users only.
                        aria-current={current ? 'page' : undefined}
                        className={
                          current
                            ? 'text-text-default decoration-brand-default underline decoration-2 underline-offset-8'
                            : 'text-text-muted hover:text-text-default underline-offset-8 transition-colors duration-150 hover:underline'
                        }
                      >
                        {label[surface.key]}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="ms-auto flex items-center gap-4">
              <ThemeToggle locale={locale} />
              {/* Decorative: the grouping is already in the markup. */}
              <span aria-hidden="true" className="bg-border-default hidden h-5 w-px sm:block" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void logout().then(() => {
                    router.replace(surfacePath('landing', locale));
                  });
                }}
              >
                {t.nav.logOut}
              </Button>
            </div>
          </div>
        </header>
      )}

      {/*
       * No width and no padding here. The dashboard composes itself in
       * full-bleed bands the way the landing page does, so a wrapper with a
       * measure would defeat the alternating grounds before they started. Every
       * surface that needs a measure sets its own.
       */}
      <main id="main">{children}</main>
    </>
  );
}
