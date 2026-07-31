/** The wizard's steps, in order. The index is what the server persists. */
export const STEPS = ['role', 'plant', 'line'] as const;

export type Step = (typeof STEPS)[number];

/**
 * Everything the wizard collects.
 *
 * Every field is optional because the wizard is resumable: a user who closed
 * the tab after step one has a genuinely partial answer set, and modelling that
 * as "complete but with empty strings" is how a plant called `""` ends up in
 * the database.
 */
export interface OnboardingAnswers {
  role?: string;
  plant_name?: string;
  plant_country?: string;
  line_name?: string;
  line_kind?: string;
  cell_format?: string;
}

export interface OnboardingProgress {
  current_step: number;
  answers: OnboardingAnswers;
  completed_at: string | null;
}

/** Which answers a step will not continue without. */
export const REQUIRED_BY_STEP: Record<Step, readonly (keyof OnboardingAnswers)[]> = {
  role: ['role'],
  plant: ['plant_name', 'plant_country'],
  line: ['line_name', 'line_kind', 'cell_format'],
};
