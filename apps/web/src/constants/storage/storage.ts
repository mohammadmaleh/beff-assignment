/**
 * The keys this app owns in `localStorage`.
 *
 * They are namespaced (`beff-`) because `localStorage` is per *origin*, not per
 * app: anything else served from the same host shares the drawer. And they are
 * constants because each is read in one place and written in another — the
 * theme is written by `ThemeToggle` and read by a blocking script in `<head>`
 * that has to run before React exists. Two literals that must agree across that
 * boundary is exactly the pair that silently stops agreeing, and the symptom is
 * a white flash on every navigation for the one reader who chose dark.
 */

/** The reader's pinned appearance, or absent to follow the OS. */
export const THEME_STORAGE_KEY = 'beff-theme';

/**
 * The cookie-consent record.
 *
 * In `localStorage` rather than a cookie, deliberately: the choice is never
 * sent to the server, and a cookie storing consent would itself need consenting
 * to.
 */
export const CONSENT_STORAGE_KEY = 'beff-cookie-consent';
