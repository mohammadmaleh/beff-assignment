import { buttonClassName } from '@beff/ui/button';
import { Display } from '@beff/ui/display';
import { Lede } from '@beff/ui/lede';

import Link from 'next/link';

import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { DEFAULT_LOCALE, getDictionary } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

/**
 * 404 inside a locale segment.
 *
 * Next does not pass `params` to `not-found.tsx`, so the locale is genuinely
 * unavailable here - this file cannot know whether the reader is on `/en` or
 * `/de`. Rather than pretend, it renders in the default locale and offers the
 * way back; guessing from a header would be a coin flip presented as certainty.
 *
 * Not a bare "404". A wrong URL is usually a stale link or a typo, so the page
 * says which of those it probably was and gives the two destinations that are
 * always right.
 */
export default function NotFound() {
  const locale = DEFAULT_LOCALE;
  const t = getDictionary(locale);

  return (
    <>
      <SiteHeader locale={locale} />
      <main id="main" className="mx-auto max-w-2xl px-6 py-24">
        <p className="text-text-muted font-(family-name:--type-family-data) text-[length:var(--type-ui-size-sm)] tabular-nums">
          404
        </p>
        <Display as="h1" className="mt-4">
          {t.errors.notFoundTitle}
        </Display>
        <Lede className="mt-4">{t.errors.notFoundBody}</Lede>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href={surfacePath('landing', locale)}
            /*
             * This was the drifted copy: `rounded-chamfer` rather than
             * `rounded-control` - the band radius on a control, which the
             * Button's own comment calls a browser default nobody styled - and
             * no transition, no press, no minimum height. It had been a
             * visibly different primary button from the header's for as long
             * as the page existed, which is what a copied class string does.
             */
            className={buttonClassName()}
          >
            {t.errors.backHome}
          </Link>
          <Link href={surfacePath('dashboard', locale)} className="underline underline-offset-4">
            {t.nav.dashboard}
          </Link>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
