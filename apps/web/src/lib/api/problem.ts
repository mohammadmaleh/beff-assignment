/**
 * RFC 9457 Problem Details, as the API renders them.
 *
 * Two members carry the machine-readable part, and neither is prose:
 *
 * * `code` — the top-level, namespaced identifier for *this* failure:
 *   `auth.email_already_registered`, `rate_limit_exceeded`. It is the whole
 *   reason the API never has to know which language is on screen.
 * * `errors` — a stable `code` per field, for the failures that belong next to
 *   an input rather than in a banner.
 *
 * The English `title` and `detail` are for a developer reading a log. Nothing
 * in this app renders them, because they arrive in one language.
 */
export interface Problem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  code?: string;
  errors?: readonly { field?: string; code?: string; detail?: string }[];
}

/** Field name → the error code the server returned for it. */
export type FieldErrors = Record<string, string>;

/** Everything a caller can act on, extracted from a failed response. */
export interface ParsedProblem {
  /** The API's own code, or `null` when the failure never reached the API. */
  code: string | null;
  fields: FieldErrors;
}

const PROBLEM_TYPE = 'application/problem+json';

const EMPTY: ParsedProblem = { code: null, fields: {} };

/**
 * Read the code and the per-field codes out of a failed response.
 *
 * Everything that is not a problem document — a 502 from a proxy, an HTML error
 * page, a body truncated mid-flight — parses to no code and no fields. That is
 * not a gap to fill with a guess: those are failures of the *request*, and
 * telling someone to check their email address sends them hunting for a mistake
 * they did not make.
 */
export const parseProblem = async (response: Response): Promise<ParsedProblem> => {
  if (!response.headers.get('content-type')?.includes(PROBLEM_TYPE)) return EMPTY;

  let problem: Problem;
  try {
    problem = (await response.json()) as Problem;
  } catch {
    return EMPTY;
  }

  const fields: FieldErrors = {};
  for (const entry of problem.errors ?? []) {
    if (entry.field === undefined) continue;
    fields[entry.field] = entry.code ?? entry.detail ?? 'unknown';
  }
  return { code: problem.code ?? null, fields };
};

/** The field-only view, for callers with no banner to put a code in. */
export const problemFieldErrors = async (response: Response): Promise<FieldErrors> =>
  (await parseProblem(response)).fields;
