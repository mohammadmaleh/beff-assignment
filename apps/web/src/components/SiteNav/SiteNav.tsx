'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getDictionary, type Locale } from '@/lib/i18n';
import { marketingNav, surfacePath, type MarketingNavKey } from '@/lib/navigation';

/**
 * The marketing header's navigation.
 *
 * ## Why this is a client component
 *
 * Only to read `usePathname`, so the current page can carry `aria-current`.
 * Next prerenders client components, so the links are still in the static HTML
 * - the progressive-enhancement claim is untouched, and `curl` still shows the
 * whole nav.
 *
 * ## `aria-current`, not just a colour
 *
 * "You are here" was the thing the old header could not express at all, and it
 * is the reason it read as a row of unrelated links. Marking it with an
 * attribute rather than only a class means a screen reader announces
 * "current page" and the styling is derived from the same fact rather than
 * duplicating it - one source of truth, and it cannot drift.
 *
 * ## Why the links are not underlined by default
 *
 * The previous header underlined everything, which flattened the whole bar to
 * one weight: a nav link, a sign-in link and a primary action all shouted
 * equally and the eye had nowhere to land. Underline on hover and focus only;
 * the persistent underline is spent on the *current* item, where it means
 * something.
 */
export function SiteNav({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const pathname = usePathname();

  const label: Record<MarketingNavKey, string> = {
    product: t.nav.product,
    technology: t.nav.technology,
    about: t.footer.about,
  };

  return (
    <nav aria-label={t.nav.primary}>
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {marketingNav.map((key) => {
          const href = surfacePath(key, locale);
          const current = pathname === href;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={
                  current
                    ? 'text-text-default decoration-brand-default underline decoration-2 underline-offset-8'
                    : 'text-text-muted hover:text-text-default underline-offset-8 transition-colors duration-150 hover:underline'
                }
              >
                {label[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
