import Link from 'next/link';

import { buttonClassName } from '@beff/ui/button';
import { ThemeToggle } from '@beff/ui/theme-toggle';

import { BrandMark } from '@/components/BrandMark';
import { SiteNav } from '@/components/SiteNav';

import { THEME_STORAGE_KEY } from '@/constants/storage';
import { getDictionary, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

/**
 * The pre-auth header. The authenticated app has its own.
 *
 * ## Three tiers of weight, not one
 *
 * The old version underlined every item, so a nav link, the sign-in link and
 * the primary action all carried the same emphasis and the bar read as a pile.
 * The hierarchy now goes:
 *
 * 1. **Request access** — solid brand fill. The one action this surface exists
 *    to produce, and the only filled element in the header.
 * 2. **Navigation** — muted, underlined on hover, with the current page marked.
 * 3. **Log in and theme** — quietest. A returning user knows where sign-in is
 *    and does not need it competing with the pitch; a visitor evaluating the
 *    product must not be pushed toward a door they have no key for.
 *
 * The two groups are separated by a rule rather than by spacing alone, because
 * "places you can go" and "things you can do here" are different kinds of thing
 * and the gap between them was reading as an accident.
 *
 * ## What is deliberately absent
 *
 * **The legal pages.** §5 DDG asks for the Impressum to be *leicht erkennbar und
 * unmittelbar erreichbar*; a footer on every page satisfies both, and it is
 * where a German reader looks. Promoting four legal documents into the bar would
 * crowd out the three things a visitor actually came for.
 */
export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  return (
    <header className="border-border-default border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-6 py-4">
        <Link href={surfacePath('landing', locale)} className="inline-flex items-center rounded-xs">
          <BrandMark className="h-6" />
        </Link>

        <SiteNav locale={locale} />

        {/*
         * `ms-auto` rather than `justify-between` on the row: with three groups
         * and wrapping enabled, space-between strands the nav in the middle at
         * intermediate widths. Pushing only the utility cluster keeps the logo
         * and nav together as one unit at every size.
         */}
        <div className="ms-auto flex items-center gap-4">
          <ThemeToggle labels={t.nav.theme} storageKey={THEME_STORAGE_KEY} />

          {/* Decorative: the grouping it expresses is already in the markup. */}
          <span aria-hidden="true" className="bg-border-default hidden h-5 w-px sm:block" />

          <Link
            href={surfacePath('login', locale)}
            className="text-text-muted hover:text-text-default text-[length:var(--type-ui-size-sm)] underline-offset-4 transition-colors duration-150 hover:underline"
          >
            {t.nav.logIn}
          </Link>

          {/*
           * An absolute path with the fragment, never a bare `#waitlist`: the
           * header is on every page and the anchor only exists on the landing
           * one. From the Impressum a bare fragment is a link that silently does
           * nothing. It also has to match the hero's href character for
           * character, or the two read as one name with two destinations in a
           * screen reader's link rotor.
           */}
          <Link
            href={`${surfacePath('landing', locale)}#waitlist`}
            // `sm`: the header's control sits in a row of navigation links and
            // must not out-weigh the wordmark beside it. The hero's copy of
            // this CTA takes the default size.
            className={buttonClassName({ size: 'sm' })}
          >
            {t.landing.ctaPrimary}
          </Link>
        </div>
      </div>
    </header>
  );
}
