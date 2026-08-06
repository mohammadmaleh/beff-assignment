'use client';

import { useEffect, useState } from 'react';

import { cx } from '../../lib/cx/index';
import { DARK_SCHEME_QUERY } from '../../lib/media/index';

type Theme = 'light' | 'dark';

export interface ThemeToggleProps {
  /**
   * The button's accessible name in each direction - and it is the *whole* of
   * its accessible content, because the glyph is `aria-hidden`. Required, and
   * phrased as the **action** ("Switch to dark appearance"), so a screen-reader
   * user hears what pressing it does rather than a setting whose effect they
   * have to infer.
   */
  labels: { toDark: string; toLight: string };
  /**
   * Where the choice is persisted, shared with the blocking script that applies
   * it before first paint. The two are halves of one contract and never see
   * each other, which is why the key is passed rather than assumed.
   */
  storageKey: string;
  className?: string;
}

/**
 * A two-state theme control.
 *
 * There is no "system" option, because offering one asked the reader to pick a
 * default they already had. The page reads `prefers-color-scheme` and follows it
 * - including when it changes mid-session, which is what an OS on a sunset
 * schedule does - and only stops once the reader overrides it. That is the same
 * behaviour the three-option select had, minus the option that explained it.
 *
 * A `<button>`, not a `<select>`: two mutually exclusive states with an obvious
 * next step is a toggle, and a native button already carries keyboard
 * operation, focus and an accessible name with no ARIA at all. The name is the
 * *action* ("Switch to dark appearance"), so a screen-reader user hears what
 * pressing it does rather than a setting they must infer the effect of.
 *
 * The glyph shows the theme you would move to, and is `aria-hidden` - the
 * button's name is its entire accessible content, which is why that name is a
 * required, translated string rather than anything assembled from literals.
 */
export function ThemeToggle({ labels, storageKey, className }: ThemeToggleProps) {
  // "light" is the server's guess, and it has to be *a* guess: the markup is
  // static, and no amount of care lets it know the reader's OS. The effect
  // corrects it before paint matters, and `ThemeScript` has already applied any
  // pinned choice to <html>, so nothing flashes for the readers who chose.
  const [theme, setTheme] = useState<Theme>('light');
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
      setPinned(true);
      return;
    }

    // Nothing pinned, so the media query is what the reader is actually looking
    // at. Reading it is not the same as writing it: pinning on load would freeze
    // a visitor into whatever their OS said the first time they arrived.
    const query = window.matchMedia(DARK_SCHEME_QUERY);
    setTheme(query.matches ? 'dark' : 'light');

    const follow = (event: MediaQueryListEvent): void => {
      setTheme(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', follow);
    return () => {
      query.removeEventListener('change', follow);
    };
  }, [pinned, storageKey]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  const choose = (): void => {
    setTheme(next);
    setPinned(true);
    window.localStorage.setItem(storageKey, next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <button
      type="button"
      onClick={choose}
      aria-label={next === 'dark' ? labels.toDark : labels.toLight}
      className={cx(
        'border-border-default text-text-muted hover:border-border-strong hover:text-text-default hover:bg-surface-raised rounded-control inline-flex size-9 items-center justify-center border transition-colors duration-150',
        className,
      )}
    >
      {next === 'dark' ? <MoonGlyph /> : <SunGlyph />}
    </button>
  );
}

/*
 * Drawn rather than pulled from an icon set. Two glyphs do not justify a
 * dependency, and a stroke weight chosen to sit on the same hairline as every
 * rule and border on the page is the whole point - a stock 2px icon reads as
 * imported, because it is.
 */

function SunGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
    >
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6L16 16M16 4l-1.4 1.4M5.4 14.6L4 16" />
    </svg>
  );
}

function MoonGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    >
      <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z" />
    </svg>
  );
}
