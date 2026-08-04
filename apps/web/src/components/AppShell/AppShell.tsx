'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Button } from '@beff/ui/button';

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
        <header className="border-border-default border-b">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-8">
              <Link
                href={surfacePath('dashboard', locale)}
                className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-lg)] [font-stretch:125%]"
              >
                Beff
              </Link>
              <nav aria-label={t.nav.primary}>
                <ul className="flex items-center gap-6">
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
                              ? 'decoration-brand-default underline decoration-2 underline-offset-8'
                              : 'hover:underline hover:underline-offset-8'
                          }
                        >
                          {label[surface.key]}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle locale={locale} />
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

      <main id="main" className="mx-auto max-w-5xl px-6 py-12">
        {children}
      </main>
    </>
  );
}
