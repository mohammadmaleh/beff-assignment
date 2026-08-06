import countries from 'i18n-iso-countries';
import de from 'i18n-iso-countries/langs/de.json';
import en from 'i18n-iso-countries/langs/en.json';

import type { Locale } from '@/lib/i18n';
import type { CountryOption } from '@beff/ui/country-select';

/*
 * Registered once, at module load, for exactly the locales this app ships.
 *
 * `i18n-iso-countries` carries every language in the package; importing the two
 * JSON files by name is what keeps the other ninety out of the bundle. The list
 * is ISO 3166-1 itself — the same standard the `country_code ~ '^[A-Z]{2}$'`
 * CHECK constraint on `plants` enforces — so the picker cannot offer a value
 * the database will reject.
 */
countries.registerLocale(en);
countries.registerLocale(de);

/**
 * Every country, named in `locale` and sorted the way that locale sorts.
 *
 * The collation is the point. `Intl.Collator('de')` files `Österreich` under O,
 * where a German reader looks for it; a plain `sort()` compares UTF-16 code
 * units and files it after `Zypern`, which is not a quirk but a list nobody can
 * scan. Swedish would want it after Z — which is exactly why this decision
 * belongs to the app that knows the language and not to the picker.
 *
 * Memoised per locale: the list is 250 entries and the same for every render.
 */
const cache = new Map<Locale, readonly CountryOption[]>();

export const getCountries = (locale: Locale): readonly CountryOption[] => {
  const cached = cache.get(locale);
  if (cached) return cached;

  const collator = new Intl.Collator(locale);
  const list = Object.entries(countries.getNames(locale, { select: 'official' }))
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => collator.compare(a.name, b.name));

  cache.set(locale, list);
  return list;
};

/**
 * The name for a stored code, or the code itself.
 *
 * The fallback is deliberate: the review step must show *something* truthful
 * for an answer the user gave, and a code the current ISO tables no longer
 * carry is still what the record holds.
 */
export const getCountryName = (code: string, locale: Locale): string =>
  countries.getName(code.toUpperCase(), locale, { select: 'official' }) ?? code.toUpperCase();
