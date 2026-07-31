import { de } from './de';
import { deApp } from './de.auth';
import { en } from './en';
import { enApp } from './en.auth';
import type { Locale } from './locales';

/**
 * `en` is the shape every other locale must satisfy, so a missing German string
 * is a type error rather than an English word appearing mid-sentence in
 * production.
 *
 * The dictionary is assembled from two files per locale: marketing copy, which
 * changes with positioning, and app copy, which changes with the surfaces.
 * They are one object at the call site so a component never has to know which
 * half a string came from.
 */
export type Dictionary = typeof en & typeof enApp;

const DICTIONARIES: Record<Locale, Dictionary> = {
  en: { ...en, ...enApp },
  de: { ...de, ...deApp },
};

/**
 * Synchronous and statically imported, because every page that uses it is
 * statically generated. A dynamic `import()` here would make the landing page
 * async for no benefit and put a waterfall in front of the first paint.
 */
export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];

/**
 * Turn a server error code into a sentence in the reader's language.
 *
 * An unrecognised code falls back to a usable message rather than to the raw
 * code or to nothing — a backend that adds a validation rule must not be able
 * to produce a field marked invalid with no explanation next to it.
 */
export const translateFieldError = (locale: Locale, code: string): string =>
  DICTIONARIES[locale].fieldErrors[code] ?? DICTIONARIES[locale].fieldErrors.unknown ?? code;
