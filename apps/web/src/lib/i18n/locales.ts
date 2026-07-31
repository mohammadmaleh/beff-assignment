/**
 * German is a shipped locale, not an afterthought. The customer is a German
 * cell manufacturer and the Impressum and Datenschutzerklärung are legal
 * requirements under §5 DDG — they exist in German first.
 *
 * That has a layout consequence the whole design has to absorb: German runs
 * roughly 30% longer than English. It is why CSS logical properties are a
 * project rule rather than a preference.
 */
export const LOCALES = ['en', 'de'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

/** The locale the language switcher offers. With two locales this is the other one. */
export const otherLocale = (current: Locale): Locale => (current === 'en' ? 'de' : 'en');
