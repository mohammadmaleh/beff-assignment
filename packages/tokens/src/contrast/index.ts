import {
  converter,
  differenceCiede2000,
  filterDeficiencyDeuter,
  filterDeficiencyProt,
  wcagContrast,
} from 'culori';

/** A colour in any CSS-parseable notation. */
export type Hex = string;

const toOklch = converter('oklch');
const toRgb = converter('rgb');
const ciede = differenceCiede2000();
const deuter = filterDeficiencyDeuter(1);
const prot = filterDeficiencyProt(1);

/**
 * WCAG 2.x contrast ratio, 1–21. Symmetric in its arguments.
 */
export function contrastRatio(a: Hex, b: Hex): number {
  return wcagContrast(a, b);
}

/**
 * oklch hue in degrees, 0–360.
 *
 * culori leaves `h` undefined for achromatic colours. Callers subtract these
 * values, so undefined is normalised to 0 rather than allowed to become NaN.
 */
export function hueOf(color: Hex): number {
  const parsed = toOklch(color);
  if (parsed === undefined) {
    throw new Error(`Could not parse colour: ${color}`);
  }
  return parsed.h ?? 0;
}

/**
 * Shortest angular distance between two hues, 0–180.
 */
export function hueSeparation(a: Hex, b: Hex): number {
  const raw = Math.abs(hueOf(a) - hueOf(b));
  return Math.min(raw, 360 - raw);
}

/**
 * Worst-case perceptual distance between two colours under the two most
 * common colour vision deficiencies.
 *
 * Returns the *minimum* of the deuteranope and protanope distances: a pair is
 * only safe if it survives both.
 *
 * culori's deficiency filters are typed as `<C extends Color>(color: C) => C`
 * - `Color` is a union of parsed colour objects and does not include `string`,
 * even though the runtime implementation parses strings just fine. The hex
 * inputs are converted to `Rgb` objects first so this satisfies `tsc`.
 */
export function cvdDistance(a: Hex, b: Hex): number {
  const rgbA = toRgb(a);
  const rgbB = toRgb(b);
  if (rgbA === undefined || rgbB === undefined) {
    throw new Error(`Could not parse colour: ${rgbA === undefined ? a : b}`);
  }
  return Math.min(ciede(deuter(rgbA), deuter(rgbB)), ciede(prot(rgbA), prot(rgbB)));
}
