import type { Locale } from '../i18n/index';

/**
 * # Information architecture (M4-pre)
 *
 * The app is five surfaces. This module is the list, and `surfaces.test.ts`
 * fails if a route exists that is not on it — the IA is a gate, not a document
 * that drifts out of date the week after it is written.
 *
 * The shape of it comes from who the user is. A process engineer arrives with a
 * question — *where did yield go this week* — not with a desire to explore an
 * app. So the hierarchy is deliberately flat: three destinations in the primary
 * nav, no nested sections, and every authenticated surface reachable in one
 * click from any other. There is no "Settings" catch-all; the two things a user
 * actually changes about their account are their consent and their existence,
 * and both live on Profile where the GDPR obligations are visible together
 * rather than buried a level down.
 *
 * ## The five surfaces
 *
 * | Surface    | Who is there                      | The one thing it must do                     |
 * | ---------- | --------------------------------- | -------------------------------------------- |
 * | Landing    | A stranger evaluating the product | Say what it is, in their vocabulary          |
 * | Auth       | A returning or new user           | Get out of the way                           |
 * | Onboarding | A new user, once                  | Capture plant and line setup, and be resumable |
 * | Dashboard  | The daily user                    | Show where yield was lost                    |
 * | Profile    | A user exercising a right         | Consent, export, erasure — legible and reversible where the law says so |
 *
 * Legal pages (Impressum, Datenschutzerklärung) hang off Landing rather than
 * forming a sixth surface: they are required by §5 DDG and Art. 13 GDPR, they
 * are linked from every footer, and treating them as a destination would
 * overstate what they are.
 */
export interface Surface {
  key: SurfaceKey;
  /** Path segments below the locale. Empty means the locale root. */
  segments: readonly string[];
  /** Authenticated surfaces are client-rendered — see decision #3 in the roadmap. */
  requiresAuth: boolean;
  /** Whether it appears in the primary navigation of the authenticated app. */
  inPrimaryNav: boolean;
}

export type SurfaceKey =
  | 'landing'
  | 'impressum'
  | 'privacy'
  | 'login'
  | 'register'
  | 'onboarding'
  | 'dashboard'
  | 'profile';

export const SURFACES: Readonly<Record<SurfaceKey, Surface>> = {
  landing: { key: 'landing', segments: [], requiresAuth: false, inPrimaryNav: false },
  impressum: {
    key: 'impressum',
    segments: ['impressum'],
    requiresAuth: false,
    inPrimaryNav: false,
  },
  // The German word, in both locales. It is the term a German user looks for,
  // and translating a legal page's URL is how you end up with two of them.
  privacy: {
    key: 'privacy',
    segments: ['datenschutz'],
    requiresAuth: false,
    inPrimaryNav: false,
  },
  login: { key: 'login', segments: ['login'], requiresAuth: false, inPrimaryNav: false },
  register: { key: 'register', segments: ['register'], requiresAuth: false, inPrimaryNav: false },
  onboarding: {
    key: 'onboarding',
    segments: ['onboarding'],
    requiresAuth: true,
    // Deliberately absent from the nav. It is a one-time flow, and offering an
    // escape hatch mid-wizard is how a half-configured account happens.
    inPrimaryNav: false,
  },
  dashboard: {
    key: 'dashboard',
    segments: ['dashboard'],
    requiresAuth: true,
    inPrimaryNav: true,
  },
  profile: { key: 'profile', segments: ['profile'], requiresAuth: true, inPrimaryNav: true },
};

/** Build the href for a surface in a locale. Never hand-write one of these. */
export const surfacePath = (key: SurfaceKey, locale: Locale): string =>
  `/${[locale, ...SURFACES[key].segments].join('/')}`;

export const primaryNav: readonly Surface[] = Object.values(SURFACES).filter(
  (surface) => surface.inPrimaryNav,
);
