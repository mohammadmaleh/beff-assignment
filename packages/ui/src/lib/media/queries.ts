/**
 * The media queries this design system reads from JavaScript.
 *
 * Every one of them is also expressed in CSS, and that is exactly why they are
 * constants. A query string is a *contract with the stylesheet*: the chart
 * layer re-reads its colour tokens on `prefers-color-scheme`, the token sheet
 * paints from the same query, and `ThemeToggle` decides its initial glyph from
 * it. Three copies of `'(prefers-color-scheme: dark)'` is three chances for one
 * of them to be typed `prefers-colour-scheme` - which matches nothing, throws
 * nothing, and simply stops updating.
 */

/** The reader's OS-level appearance preference. */
export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/**
 * The reader asking for less movement.
 *
 * CSS handles this for anything the cascade can reach. Canvas and SVG animated
 * by a render loop are outside it, so the preference has to be read and passed
 * in - see `useReducedMotion`.
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
