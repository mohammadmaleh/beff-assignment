'use client';

import { useState } from 'react';

import { Alert } from '@beff/ui/alert';
import { Button } from '@beff/ui/button';

import { AUTH_ROUTES } from '@/constants/api';
import { ApiError, authFetch, useAuth } from '@/lib/auth';
import { getDictionary, type Locale } from '@/lib/i18n';

type Status = 'idle' | 'sending' | 'sent' | 'already' | 'limited' | 'failed';

/**
 * The reminder an unconfirmed account carries, with a resend beside it.
 *
 * **Not a blocker, deliberately.** Nothing in this product is gated on a
 * confirmed address: registration signs you in, the dashboard renders, and the
 * account works. Gating would trade a real user's first session against a
 * system that is allowed to be slow and is sometimes filtered — and every
 * threat the copy could make about it would be untrue.
 *
 * It renders nothing at all once the address is confirmed, rather than a
 * success state nobody asked to keep seeing.
 */
export function UnverifiedBanner({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('idle');

  if (user === null || user.email_verified_at !== null) return null;

  const resend = async (): Promise<void> => {
    setStatus('sending');
    try {
      await authFetch<unknown>(AUTH_ROUTES.resendVerification, {
        method: 'POST',
        // The locale the reader is *reading the site in* is better evidence
        // than a browser preference set years ago, so it is sent explicitly.
        body: { locale },
      });
      setStatus('sent');
    } catch (error) {
      if (error instanceof ApiError) {
        // 409 is "already confirmed" — which can genuinely happen, if the link
        // was followed in another tab between this page loading and the click.
        // 429 is the resend limiter. Both deserve their own sentence: "try
        // again" is wrong advice for the first and useless for the second.
        setStatus(error.status === 409 ? 'already' : error.status === 429 ? 'limited' : 'failed');
        return;
      }
      setStatus('failed');
    }
  };

  const message: Record<Status, string | null> = {
    idle: null,
    sending: null,
    sent: t.unverified.sent,
    already: t.unverified.alreadyVerified,
    limited: t.unverified.rateLimited,
    failed: t.unverified.failed,
  };

  return (
    <div className="border-border-default border-b">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <Alert tone="warning" title={t.unverified.title} prefixes={t.a11y.alertPrefixes}>
          <p>{t.unverified.body.replace('{email}', user.email)}</p>

          {/*
           * The outcome is announced, not only shown. A resend that succeeds
           * changes nothing visible except this sentence, so a screen-reader
           * user who cannot see it has no way to know the click did anything.
           */}
          <p role="status" aria-live="polite" className="mt-2 min-h-[1lh]">
            {message[status]}
          </p>

          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            loading={status === 'sending'}
            // Required: the default is an English string, and this button ships
            // on a German page.
            loadingLabel={t.unverified.resending}
            // `sent` and `already` are terminal for this render: a second
            // message would be suppressed by the outbox anyway, so offering the
            // button again would promise something that does not happen.
            disabled={status === 'sent' || status === 'already'}
            onClick={() => {
              void resend();
            }}
          >
            {t.unverified.resend}
          </Button>
        </Alert>
      </div>
    </div>
  );
}
