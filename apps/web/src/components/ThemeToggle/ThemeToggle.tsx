'use client';

import { useEffect, useState } from 'react';

import { THEME_STORAGE_KEY } from '@/components/ThemeScript';
import { getDictionary, type Locale } from '@/lib/i18n';

type Choice = 'system' | 'light' | 'dark';

const CHOICES: readonly Choice[] = ['system', 'light', 'dark'];

/**
 * A native `<select>`, not a custom listbox.
 *
 * Native HTML before ARIA: this one element already ships keyboard navigation,
 * type-ahead, a mobile picker and every screen-reader announcement a
 * hand-rolled combobox spends two hundred lines failing to reproduce.
 */
export function ThemeToggle({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [choice, setChoice] = useState<Choice>('system');

  // Reads after mount rather than during render. The server has no
  // localStorage, and a value read during render would not match the markup it
  // hydrates against.
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') setChoice(stored);
  }, []);

  const apply = (next: Choice): void => {
    setChoice(next);
    if (next === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
      // Removing the attribute hands control back to the token sheet's
      // `prefers-color-scheme` block rather than pinning either theme.
      document.documentElement.removeAttribute('data-theme');
      return;
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const labels: Record<Choice, string> = {
    system: t.nav.themeSystem,
    light: t.nav.themeLight,
    dark: t.nav.themeDark,
  };

  return (
    <label className="flex items-center gap-2 text-[length:var(--type-ui-size-sm)]">
      <span className="text-text-muted">{t.nav.theme}</span>
      <select
        value={choice}
        onChange={(event) => {
          apply(event.target.value as Choice);
        }}
        className="border-border-default bg-surface-base text-text-default rounded-chamfer border px-2 py-1"
      >
        {CHOICES.map((value) => (
          <option key={value} value={value}>
            {labels[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
