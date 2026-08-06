/**
 * Units the UI prints beside a figure.
 *
 * They are constants because a unit is part of the *reading*, not decoration:
 * `Metric` renders `unit` in its own slot and the string has to be identical
 * wherever the same measurement appears, or the marketing page and the
 * dashboard label one number two ways.
 *
 * None of these is translated, and that is correct rather than an omission -
 * `%`, `pp` and `kg CO₂e/kWh` are SI-and-convention symbols, written the same
 * in German as in English. The *spacing* around `%` differs by locale, which is
 * why `%` never appears in a template literal here: see `lib/format`.
 */

/** Percentage points. A *difference* between two percentages, never a ratio. */
export const PERCENTAGE_POINTS = 'pp';

/** For `Metric`/`SpecBand`, which own their own spacing before the sign. */
export const PERCENT = '%';

/** Carbon intensity of the energy that went into a cell. */
export const CO2_INTENSITY = 'kg CO₂e/kWh';
