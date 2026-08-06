'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Alert } from '@beff/ui/alert';
import { Display } from '@beff/ui/display';

import { AUTH_ROUTES } from '@/constants/api';
import { apiUrl } from '@/lib/api';
import { getDictionary, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

type Outcome = 'checking' | 'success' | 'expired' | 'invalid' | 'missing' | 'error';

/**
 * Where the link in the confirmation email lands.
 *
 * Three things about the shape are deliberate.
 *
 * **It posts.** The token arrives in the query string because a link is a GET,
 * but redeeming it is a state change - and a GET here would be prefetched by
 * mail clients and retried by proxies, spending the single-use token before the
 * reader ever clicked.
 *
 * **It does not use `authFetch`.** That helper attaches the access token and
 * refreshes on 401, and this page is reached from a mail client that very
 * likely has no session at all. A refresh attempt here would be a wasted round
 * trip that fails, and its 401 would be reported instead of the real outcome.
 *
 * **It never signs anyone in.** The API does not return a session and this page
 * does not ask for one. A link that arrives by email and produces a session is
 * a login bypass for anyone who can read the inbox.
 */
export function VerifyEmailView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const token = useSearchParams().get('token');
  const [outcome, setOutcome] = useState<Outcome>(token === null ? 'missing' : 'checking');

  // React 18+ mounts effects twice in development StrictMode. The token is
  // single-use, so without this the second run would consume the token the
  // first one just spent and the page would report an invalid link on a
  // perfectly good one - in development only, which is the worst place to
  // debug it from.
  const attempted = useRef(false);

  useEffect(() => {
    if (token === null || attempted.current) return;
    attempted.current = true;

    let cancelled = false;

    const verify = async (): Promise<void> => {
      try {
        const response = await fetch(apiUrl(AUTH_ROUTES.verifyEmail), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (cancelled) return;

        if (response.ok) {
          setOutcome('success');
          return;
        }

        // The stable `code` is the contract, not the English `detail` - that is
        // the whole reason the API carries one, and parsing prose would break
        // this page the moment somebody rewords a sentence.
        const problem: unknown = await response.json().catch(() => null);
        const code =
          typeof problem === 'object' && problem !== null && 'code' in problem
            ? (problem as { code?: unknown }).code
            : undefined;

        if (cancelled) return;
        setOutcome(
          code === 'auth.verification_token_expired'
            ? 'expired'
            : code === 'auth.verification_token_invalid'
              ? 'invalid'
              : 'error',
        );
      } catch {
        // A dropped connection, not a bad token. Saying "this link is invalid"
        // here would send the reader off to request a replacement for a link
        // that is fine.
        if (!cancelled) setOutcome('error');
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const copy: Record<Exclude<Outcome, 'checking'>, { title: string; body: string }> = {
    success: { title: t.verifyEmail.successTitle, body: t.verifyEmail.successBody },
    expired: { title: t.verifyEmail.expiredTitle, body: t.verifyEmail.expiredBody },
    invalid: { title: t.verifyEmail.invalidTitle, body: t.verifyEmail.invalidBody },
    missing: { title: t.verifyEmail.missingTitle, body: t.verifyEmail.missingBody },
    error: { title: t.verifyEmail.errorTitle, body: t.verifyEmail.errorBody },
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <Display as="h1">{t.verifyEmail.pageTitle}</Display>

      <div className="mt-8">
        {outcome === 'checking' ? (
          /*
           * A live region, not a bare spinner. The wait is short but it is the
           * whole page, and a screen-reader user otherwise hears nothing at all
           * between arriving and the result appearing.
           */
          <p role="status" aria-live="polite" className="text-text-muted">
            {t.verifyEmail.checking}
          </p>
        ) : (
          <Alert
            tone={outcome === 'success' ? 'success' : outcome === 'error' ? 'danger' : 'warning'}
            title={copy[outcome].title}
            prefixes={t.a11y.alertPrefixes}
            // The alert *replaces* the live region above it. Without this, the
            // announcement of the outcome - the one thing the reader came for -
            // is silence following "confirming your address…".
            announce
          >
            <p>{copy[outcome].body}</p>
          </Alert>
        )}
      </div>

      <p className="mt-8 text-[length:var(--type-ui-size-sm)]">
        <Link
          href={surfacePath(outcome === 'success' ? 'dashboard' : 'login', locale)}
          className="underline underline-offset-4"
        >
          {outcome === 'success' ? t.verifyEmail.toDashboard : t.verifyEmail.toLogin}
        </Link>
      </p>
    </div>
  );
}
