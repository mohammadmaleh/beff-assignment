import Link from 'next/link';

import { ThemeToggle } from '@/components/ThemeToggle';
import { getDictionary, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

/** The pre-auth header. The authenticated app has its own with the primary nav. */
export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  return (
    <header className="border-border-default border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href={surfacePath('landing', locale)}
          className="font-(family-name:--type-family-display) text-[length:var(--type-ui-size-lg)] [font-stretch:125%]"
        >
          Beff
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle locale={locale} />
          <Link href={surfacePath('login', locale)} className="underline underline-offset-4">
            {t.nav.logIn}
          </Link>
        </div>
      </div>
    </header>
  );
}
