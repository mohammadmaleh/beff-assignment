import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LOCALES } from '../i18n/index';
import { SURFACES, primaryNav, surfacePath, type SurfaceKey } from './surfaces';

/**
 * The M4-pre gate: **every screen traces back to a named surface**.
 *
 * Without this, ENG-34 through ENG-38 each invent their own structure and the
 * product reads as five apps stapled together. "UI/UX intuitiveness" is an
 * explicitly graded section of the brief, and it is lost in exactly this way.
 *
 * `process.cwd()` rather than `new URL(x, import.meta.url)` — Vite rewrites the
 * latter into asset resolution, and this repo has already shipped a suite of
 * assertions that passed by matching their own source.
 */
const LOCALE_ROUTE_DIR = join(process.cwd(), 'src', 'app', '[locale]');

/** Route folders under `[locale]`, ignoring Next's private and group folders. */
const routeFolders = (): string[] =>
  readdirSync(LOCALE_ROUTE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('_') && !name.startsWith('(') && !name.startsWith('@'));

describe('information architecture', () => {
  it('has no route that the IA does not name', () => {
    const named = new Set(
      Object.values(SURFACES)
        .flatMap((surface) => surface.segments)
        .filter(Boolean),
    );
    for (const folder of routeFolders()) {
      expect(named, `route /${folder} is not a named surface`).toContain(folder);
    }
  });

  it('has a route for every surface it names', () => {
    const folders = new Set(routeFolders());
    for (const surface of Object.values(SURFACES)) {
      const [first] = surface.segments;
      // The landing surface is the locale root, which is a page file rather
      // than a folder.
      if (first === undefined) continue;
      expect(folders, `surface ${surface.key} has no route`).toContain(first);
    }
  });

  it('keeps the authenticated navigation flat — three destinations, no nesting', () => {
    // A time-poor engineer arrives with a question, not a desire to explore.
    expect(primaryNav.map((s) => s.key)).toEqual(['dashboard', 'profile']);
    for (const surface of Object.values(SURFACES)) {
      expect(surface.segments.length).toBeLessThanOrEqual(1);
    }
  });

  it('keeps onboarding out of the navigation', () => {
    // A one-time flow. Offering an escape hatch mid-wizard is how a
    // half-configured account happens.
    expect(SURFACES.onboarding.inPrimaryNav).toBe(false);
    expect(SURFACES.onboarding.requiresAuth).toBe(true);
  });

  it('leaves every pre-auth surface publicly reachable', () => {
    for (const key of ['landing', 'impressum', 'privacy', 'login', 'register'] as const) {
      expect(SURFACES[key].requiresAuth).toBe(false);
    }
  });

  it('builds locale-prefixed paths for every surface and locale', () => {
    for (const locale of LOCALES) {
      for (const key of Object.keys(SURFACES) as SurfaceKey[]) {
        expect(surfacePath(key, locale)).toMatch(new RegExp(`^/${locale}(/|$)`));
      }
    }
  });

  it('keeps the privacy page on its German path in both locales', () => {
    // The term a German user looks for. Translating a legal page's URL is how
    // you end up with two of them and a broken link from the Impressum.
    expect(surfacePath('privacy', 'en')).toBe('/en/datenschutz');
    expect(surfacePath('privacy', 'de')).toBe('/de/datenschutz');
  });
});
