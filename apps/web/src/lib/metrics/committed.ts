import { PROCESS_STEPS, type ProcessStep } from './steps';

/**
 * Value committed to a cell by the time it is lost, in euros.
 *
 * **These mirror `COMMITTED_VALUE` in `apps/api/src/beff/seed/seed.py`** - the
 * same figures the dashboard costs its scrap against. The landing page argues
 * from this curve, so if the two ever disagree the marketing surface is making a
 * case the product contradicts on the next screen. `committed.test.ts` reads the
 * Python file and asserts they match, which is cheaper than remembering.
 *
 * A ~€16 pouch cell. Rising sharply through the line is the entire economic
 * argument: material, energy and line time go in at every step and none of it
 * comes back out.
 */
export const COMMITTED_VALUE_EUR: Readonly<Record<ProcessStep, number>> = {
  mixing: 1.1,
  coating: 3.4,
  drying: 3.9,
  calendering: 4.6,
  slitting: 5.1,
  die_cutting: 5.6,
  stacking: 7.2,
  welding: 8.1,
  filling: 10.4,
  formation: 14.8,
  aging: 15.6,
  eol_test: 16.4,
};

const FINISHED = COMMITTED_VALUE_EUR.eol_test;

/**
 * The same curve as a share of finished cell cost.
 *
 * The landing figure plots shares rather than euros deliberately: a share needs
 * no cell size, chemistry or year to be meaningful, and it states the comparison
 * the page is making more directly - 90 per cent against 21 per cent is the
 * sentence, not a conversion of it.
 */
export const COMMITTED_VALUE_PCT: Readonly<Record<ProcessStep, number>> = Object.fromEntries(
  PROCESS_STEPS.map((step) => [step, Math.round((COMMITTED_VALUE_EUR[step] / FINISHED) * 100)]),
) as Record<ProcessStep, number>;

/** The curve in process order, ready to plot. Never sorted by magnitude. */
export const committedValueCurve: readonly { step: ProcessStep; pct: number }[] = PROCESS_STEPS.map(
  (step) => ({ step, pct: COMMITTED_VALUE_PCT[step] }),
);
