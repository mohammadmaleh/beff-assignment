import Link from 'next/link';

import { getDictionary, otherLocale, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

/**
 * Impressum and Datenschutzerklärung are linked from every page, not tucked
 * into an "about" section. §5 DDG requires the imprint to be *leicht
 * erkennbar und unmittelbar erreichbar* — easily recognisable and directly
 * reachable — and a German reviewer will check.
 */
export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const other = otherLocale(locale);
  const otherName = getDictionary(other).meta.localeName;

  return (
    <footer className="border-border-default mt-24 border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-lg)] [font-stretch:125%]">
            Beff
          </span>
          <p className="text-text-muted max-w-xs text-[length:var(--type-ui-size-sm)]">
            {t.footer.tagline}
          </p>
        </div>

        <nav aria-label={t.footer.legal} className="flex flex-col gap-2">
          <h2 className="text-text-muted text-[length:var(--type-ui-size-xs)] tracking-wide uppercase">
            {t.footer.legal}
          </h2>
          <Link href={surfacePath('impressum', locale)} className="underline underline-offset-4">
            {t.footer.impressum}
          </Link>
          <Link href={surfacePath('privacy', locale)} className="underline underline-offset-4">
            {t.footer.privacy}
          </Link>
        </nav>

        <div className="flex flex-col gap-2">
          <h2 className="text-text-muted text-[length:var(--type-ui-size-xs)] tracking-wide uppercase">
            {t.footer.language}
          </h2>
          {/*
           * A real link, not a client-side locale swap. It changes the URL, so
           * it must be shareable, crawlable and openable in a new tab —
           * `hrefLang` tells a crawler what it will find there.
           */}
          <Link
            href={surfacePath('landing', other)}
            hrefLang={other}
            lang={other}
            className="underline underline-offset-4"
          >
            {t.meta.switchTo}
          </Link>
          <span className="sr-only">{otherName}</span>
        </div>
      </div>

      <p className="text-text-muted mx-auto max-w-5xl px-6 pb-8 text-[length:var(--type-ui-size-xs)]">
        © {new Date().getFullYear()} Beff GmbH. {t.footer.rights}
      </p>
    </footer>
  );
}
