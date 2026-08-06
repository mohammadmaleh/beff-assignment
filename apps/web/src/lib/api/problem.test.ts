import { describe, expect, it } from 'vitest';

import { parseProblem, problemFieldErrors } from './problem';

/** A response shaped the way the API's RFC 9457 handlers render one. */
const problemResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

describe('parseProblem', () => {
  it('keeps the top-level code, which is the whole contract with the client', async () => {
    // The API says so in as many words: the `code`, not the English `title` or
    // `detail`, is the translation key. Dropping it is what turns "that address
    // is already registered" into "something went wrong".
    const parsed = await parseProblem(
      problemResponse(409, {
        type: 'https://beff.example/problems/auth.email_already_registered',
        title: 'Email already registered',
        status: 409,
        detail: 'That email address is already registered.',
        code: 'auth.email_already_registered',
      }),
    );

    expect(parsed.code).toBe('auth.email_already_registered');
    expect(parsed.fields).toEqual({});
  });

  it('keeps the per-field codes alongside it', async () => {
    const parsed = await parseProblem(
      problemResponse(422, {
        code: 'validation_error',
        errors: [
          { pointer: '/email', field: 'email', code: 'invalid_email' },
          { pointer: '/password', field: 'password', code: 'weak_password' },
        ],
      }),
    );

    expect(parsed.code).toBe('validation_error');
    expect(parsed.fields).toEqual({ email: 'invalid_email', password: 'weak_password' });
  });

  it('reports no code for a failure that never reached the API', async () => {
    // A 502 from a proxy, or an HTML error page. There is no code to read, and
    // inventing one would put a specific, wrong sentence on screen.
    const parsed = await parseProblem(
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    );

    expect(parsed.code).toBeNull();
    expect(parsed.fields).toEqual({});
  });

  it('survives a problem document that is truncated mid-flight', async () => {
    const parsed = await parseProblem(
      new Response('{"code": "auth.', {
        status: 500,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );

    expect(parsed.code).toBeNull();
    expect(parsed.fields).toEqual({});
  });

  it('still exposes the field-only view the waitlist form reads', async () => {
    const fields = await problemFieldErrors(
      problemResponse(422, {
        code: 'validation_error',
        errors: [{ field: 'email', code: 'already_registered' }],
      }),
    );

    expect(fields).toEqual({ email: 'already_registered' });
  });
});
