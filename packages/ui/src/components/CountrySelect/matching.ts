/** A country, as the picker needs it: a stable code and a name to read. */
export interface CountryOption {
  /** ISO 3166-1 alpha-2, uppercase. This is what the form submits. */
  code: string;
  /** The country's name **in the page's language**. The caller localises it. */
  name: string;
}

const DIACRITICS = /\p{Diacritic}/gu;

/**
 * German keyboards are not the only way German is typed.
 *
 * `ö` and `oe` are the same letter to a German reader, and a picker that only
 * accepts one of them fails whoever is on the other keyboard — which on a
 * factory floor is a real share of the shift. Neither folding subsumes the
 * other: stripping the diaeresis turns `Österreich` into `Osterreich`, which
 * `oe` does not match; expanding it gives `Oesterreich`, which `ös` does not.
 * So every string is folded **both** ways and a hit either way counts.
 */
const EXPANSIONS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

const stripped = (value: string): string =>
  value.normalize('NFD').replace(DIACRITICS, '').toLowerCase();

const expanded = (value: string): string =>
  value.toLowerCase().replace(/[äöüß]/g, (character) => EXPANSIONS[character] ?? character);

/**
 * Lower is better. Exhaustive on purpose: `undefined` means "does not match"
 * and is filtered out, so a country is never shown for a query it has nothing
 * to do with.
 */
const rank = (country: CountryOption, query: string): number | undefined => {
  const code = country.code.toLowerCase();
  const [needleStripped, needleExpanded] = [stripped(query), expanded(query)];
  const [nameStripped, nameExpanded] = [stripped(country.name), expanded(country.name)];

  // The code is an exact, two-character handle. Someone who typed `DE` meant
  // Germany, not "every country whose name contains de" — of which, in German,
  // there are more than thirty.
  if (code === needleStripped) return 0;
  if (nameStripped.startsWith(needleStripped) || nameExpanded.startsWith(needleExpanded)) return 1;
  if (nameStripped.includes(needleStripped) || nameExpanded.includes(needleExpanded)) return 2;
  return undefined;
};

/**
 * The countries matching `query`, best first.
 *
 * Ranked rather than merely filtered, because the alternative is that typing
 * `de` in German offers `Schweden` above `Deutschland` — both contain the
 * letters, and only one of them is what anybody meant.
 *
 * The sort is stable, so within a rank the caller's order survives. That order
 * is a locale-aware collation the caller owns (`Ö` sorts with `O` in German and
 * after `Z` in Swedish), and this function must not quietly re-impose ASCII.
 */
export const matchCountries = (
  countries: readonly CountryOption[],
  query: string,
): CountryOption[] => {
  const trimmed = query.trim();
  // Copied, not returned as-is: this is what downshift receives as its `items`,
  // and its type is mutable. Handing it the caller's array would invite a
  // library to sort the app's constant in place.
  if (trimmed === '') return [...countries];

  return countries
    .map((country) => ({ country, rank: rank(country, trimmed) }))
    .filter(
      (scored): scored is { country: CountryOption; rank: number } => scored.rank !== undefined,
    )
    .sort((a, b) => a.rank - b.rank)
    .map((scored) => scored.country);
};
