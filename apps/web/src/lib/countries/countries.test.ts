import { describe, expect, it } from 'vitest';

import { getCountries, getCountryName } from './countries';

describe('getCountries', () => {
  it('offers the whole ISO 3166-1 alpha-2 list', () => {
    const list = getCountries('en');
    expect(list.length).toBeGreaterThan(200);
    expect(list.every((country) => /^[A-Z]{2}$/.test(country.code))).toBe(true);
  });

  it('never offers a code the database would reject', () => {
    // `plants.country_code` carries `CHECK (country_code ~ '^[A-Z]{2}$')`, and
    // the onboarding service uppercases and truncates to two characters. A
    // three-letter or numeric code reaching the picker would be a 500 at the
    // end of a five-step wizard.
    for (const country of getCountries('de')) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.name.trim()).not.toBe('');
    }
  });

  it('names countries in the locale it was asked for', () => {
    const byCode = (locale: 'en' | 'de', code: string): string | undefined =>
      getCountries(locale).find((country) => country.code === code)?.name;

    expect(byCode('en', 'DE')).toBe('Germany');
    expect(byCode('de', 'DE')).toBe('Deutschland');
    expect(byCode('de', 'FR')).toBe('Frankreich');
  });

  it('sorts the way the locale sorts, not the way UTF-16 does', () => {
    // `Ö` is code unit 0x00D6 - past `Z`. A plain sort files Österreich at the
    // bottom of a German list, which is not where a German reader looks.
    const german = getCountries('de').map((country) => country.name);
    const austria = german.indexOf('Österreich');
    const cyprus = german.indexOf('Zypern');

    expect(austria).toBeGreaterThan(-1);
    expect(cyprus).toBeGreaterThan(-1);
    expect(austria).toBeLessThan(cyprus);
  });

  it('returns the same array for the same locale', () => {
    // 250 entries and one collation pass per render, otherwise - and a new
    // array identity would defeat the picker's own memoised filtering.
    expect(getCountries('de')).toBe(getCountries('de'));
    expect(getCountries('de')).not.toBe(getCountries('en'));
  });
});

describe('getCountryName', () => {
  it('resolves a stored code, whatever case it was stored in', () => {
    expect(getCountryName('de', 'en')).toBe('Germany');
    expect(getCountryName('DE', 'de')).toBe('Deutschland');
  });

  it('falls back to the code rather than showing a blank', () => {
    // A code ISO has since retired is still what the record holds, and the
    // review step has to show the user the answer they actually gave.
    expect(getCountryName('zz', 'de')).toBe('ZZ');
  });
});
