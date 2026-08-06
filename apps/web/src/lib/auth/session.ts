import { AUTH_ROUTES } from '@/constants/api';
import { apiUrl, parseProblem, type FieldErrors } from '@/lib/api';

/**
 * The access token lives in a module variable, never in `localStorage`.
 *
 * `localStorage` is readable by any script on the origin, so one XSS is one
 * stolen session that survives a page close. In memory, the blast radius of the
 * same bug is the current tab until reload. The refresh token is not here at
 * all - it is an httpOnly cookie the API sets, which JavaScript cannot read by
 * construction.
 */
let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

/** A failed request, carrying whatever the RFC 9457 body could tell us. */
export class ApiError extends Error {
  readonly status: number;
  readonly fields: FieldErrors;
  /**
   * The API's stable code, or `null` if the failure carried no problem document.
   *
   * A status code is a category - 409 is "you contradicted current state" - and
   * a category is not a sentence anyone can act on. `code` is the specific
   * failure, and it is the only thing on this class that a message should be
   * chosen from.
   */
  readonly code: string | null;

  constructor(status: number, fields: FieldErrors = {}, code: string | null = null) {
    super(`Request failed with status ${String(status)}${code === null ? '' : ` (${code})`}`);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
    this.code = code;
  }
}

interface Options extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Internal: prevents a refresh loop. */
  retry?: boolean;
}

/**
 * Fetch against the API with the access token attached, refreshing once on 401.
 *
 * The single retry is the whole of the concurrency story: a second 401 after a
 * refresh means the session is genuinely gone, and retrying again would spin.
 */
export async function authFetch<T>(path: string, options: Options = {}): Promise<T> {
  const { body, retry = true, headers, ...rest } = options;

  const response = await fetch(apiUrl(path), {
    ...rest,
    // The refresh cookie has to ride along, and the API is on a different
    // origin in every environment this runs in.
    credentials: 'include',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken === null ? {} : { Authorization: `Bearer ${accessToken}` }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (response.status === 401 && retry) {
    const refreshed = await refresh();
    if (refreshed) return authFetch<T>(path, { ...options, retry: false });
  }

  if (!response.ok) {
    const problem = await parseProblem(response);
    throw new ApiError(response.status, problem.fields, problem.code);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

interface SessionPayload {
  access_token: string;
}

/**
 * Exchange the refresh cookie for a new access token.
 *
 * Returns false rather than throwing: a failed refresh is the normal state for
 * a signed-out visitor, not an exception.
 */
export async function refresh(): Promise<boolean> {
  try {
    const response = await fetch(apiUrl(AUTH_ROUTES.refresh), {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      setAccessToken(null);
      return false;
    }
    const payload = (await response.json()) as SessionPayload;
    setAccessToken(payload.access_token);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}
