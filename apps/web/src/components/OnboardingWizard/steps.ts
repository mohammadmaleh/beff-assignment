/**
 * The wizard's steps, in order.
 *
 * Named, not indexed, and this list mirrors `ONBOARDING_STEPS` in the API — the
 * server persists the *name*, and the schema has a CHECK constraint on it. An
 * index would silently mean a different step the moment either side inserted
 * one.
 *
 * The server also sends its own copy of this list in every response. This
 * constant is the fallback for the first render before that arrives, and the
 * source of the per-step UI; the server's copy is what decides where the user
 * actually is.
 */
export const STEPS = ['role', 'plant', 'lines', 'units', 'review'] as const;

export type Step = (typeof STEPS)[number];

export const isStep = (value: string): value is Step =>
  (STEPS as readonly string[]).includes(value);

/**
 * Everything the wizard collects.
 *
 * Every field is optional because the wizard is resumable: a user who closed
 * the tab after step one has a genuinely partial answer set, and modelling that
 * as "complete but with empty strings" is how a plant called `""` reaches the
 * `name_not_blank` constraint.
 */
export interface OnboardingAnswers {
  role?: string;
  plant_name?: string;
  plant_country?: string;
  line_name?: string;
  line_kind?: string;
  cell_format?: string;
  unit_system?: string;
}

export interface OnboardingProgress {
  current_step: string;
  answers: OnboardingAnswers;
  completed_at: string | null;
  steps: string[];
  /** Required answers still outstanding, named by the server. */
  missing: string[];
}

/**
 * Which answers a step will not continue without.
 *
 * Mirrors `REQUIRED_ANSWERS` in the API. The server's copy is authoritative —
 * this one only exists to disable the button before a round trip, and a client
 * check can always be bypassed.
 */
export const REQUIRED_BY_STEP: Record<Step, readonly (keyof OnboardingAnswers)[]> = {
  role: ['role'],
  plant: ['plant_name', 'plant_country'],
  lines: ['line_name', 'line_kind', 'cell_format'],
  units: ['unit_system'],
  review: [],
};
