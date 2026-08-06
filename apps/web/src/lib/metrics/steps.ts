/**
 * Cell production steps, in order.
 *
 * The order is the point. Scrap discovered at `formation` is far more expensive
 * than scrap at `coating`, because all the upstream value is already committed
 * - so the breakdown is always shown in this sequence and never sorted by
 * magnitude. Keys match `process_step` in the schema and the table in
 * CONTEXT.md exactly; prose variants like `dieCut` are a bug.
 */
export const PROCESS_STEPS = [
  'mixing',
  'coating',
  'drying',
  'calendering',
  'slitting',
  'die_cutting',
  'stacking',
  'welding',
  'filling',
  'formation',
  'aging',
  'eol_test',
] as const;

export type ProcessStep = (typeof PROCESS_STEPS)[number];
