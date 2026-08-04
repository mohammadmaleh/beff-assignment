/**
 * Specification windows for the headline figures.
 *
 * ## Why these live here and not in the API
 *
 * The API already returns spec bands for *process parameters* — porosity, areal
 * loading — because those limits are per-line process settings. The windows
 * below are different in kind: they are properties of the domain rather than of
 * a customer's line, and they come straight from `CONTEXT.md`. A pilot line runs
 * 40–80% first-pass yield and a production line 85–97; that is true of every
 * cell plant, not of one plant's configuration.
 *
 * If they ever become per-customer they belong in the API beside the others,
 * and this module should disappear rather than grow a second source of truth.
 *
 * ## Why only two of the four headline metrics get one
 *
 * The design brief allows the spec band **only where a real measurement meets a
 * real limit**. First-pass yield has one, and capacity retention has one (~80%
 * at 1000 cycles is the common automotive end-of-life threshold). Total scrap
 * rate does not — it is the inverse of yield, and no plant specifies it
 * separately. CO₂ intensity has a *typical range* of 40–120 kg CO₂e/kWh, which
 * is a description of the industry, not a limit this line is held to.
 *
 * Banding all four would look consistent and be a lie about two of them.
 */

export interface SpecWindow {
  lowerLimit: number;
  upperLimit: number;
  target: number;
}

/** First-pass yield, by the kind of line producing it (CONTEXT.md, "Metrics"). */
const YIELD_WINDOWS: Readonly<Record<string, SpecWindow>> = {
  pilot: { lowerLimit: 40, upperLimit: 80, target: 70 },
  production: { lowerLimit: 85, upperLimit: 97, target: 92 },
};

/**
 * The window a first-pass yield reading should be drawn against.
 *
 * Unknown kinds fall back to `production`, the stricter band. Defaulting to
 * `pilot` would take a failing production line and quietly report it as
 * healthy; this way an unrecognised kind produces a false alarm instead of a
 * missed one, and a false alarm is the failure a plant can afford.
 */
export function yieldWindow(lineKind: string): SpecWindow {
  return YIELD_WINDOWS[lineKind] ?? YIELD_WINDOWS.production!;
}

/** Windows that do not depend on the line. */
export const HEADLINE_WINDOWS = {
  retention: { lowerLimit: 80, upperLimit: 100, target: 90 },
} as const satisfies Record<string, SpecWindow>;
