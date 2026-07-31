/**
 * RFC 9457 Problem Details, as the API renders them.
 *
 * The `errors` array is the machine-readable part: a stable `code` per field,
 * never an English sentence. That is what lets the German locale show German
 * validation messages without the backend knowing which language is on screen.
 */
export interface Problem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: readonly { field?: string; code?: string; detail?: string }[];
}

/** Field name → the error code the server returned for it. */
export type FieldErrors = Record<string, string>;

const PROBLEM_TYPE = 'application/problem+json';

/**
 * Pull the per-field codes out of a failed response.
 *
 * Returns an empty object for anything that is not a problem document — a 502
 * from a proxy, an HTML error page, a truncated body. Those are failures of the
 * request, not of the user's input, and telling someone to check their email
 * address sends them hunting for a mistake they did not make.
 */
export const problemFieldErrors = async (response: Response): Promise<FieldErrors> => {
  if (!response.headers.get('content-type')?.includes(PROBLEM_TYPE)) return {};

  let problem: Problem;
  try {
    problem = (await response.json()) as Problem;
  } catch {
    return {};
  }

  const errors: FieldErrors = {};
  for (const entry of problem.errors ?? []) {
    if (entry.field === undefined) continue;
    errors[entry.field] = entry.code ?? entry.detail ?? 'unknown';
  }
  return errors;
};
