'use client';

import { useEffect } from 'react';

import { Button } from '@beff/ui/button';
import { Display } from '@beff/ui/display';
import { Lede } from '@beff/ui/lede';

import { DEFAULT_LOCALE, getDictionary } from '@/lib/i18n';

/**
 * The route-level error boundary.
 *
 * Must be a client component — React error boundaries are a client concept, and
 * `reset()` re-renders the segment without a full page load, so a transient
 * failure costs the user a click rather than their place in the app.
 *
 * `digest` is deliberately the only thing shown from the error. Next replaces
 * the message with a hash in production precisely so a stack trace does not
 * reach a browser; printing `error.message` would put whatever a 500 leaked in
 * front of the user, and showing nothing at all leaves support with no way to
 * find the log line.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = getDictionary(DEFAULT_LOCALE);

  useEffect(() => {
    // Client-side errors never reach the server logs on their own. In
    // production this is where an error reporter would be called; the console
    // is the honest placeholder rather than a silent catch.
    console.error('Unhandled route error', error);
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-24">
      {/*
       * `role="alert"` because this replaced the page's content after the fact.
       * A screen-reader user who was reading the previous render gets told
       * something went wrong rather than finding the page silently different.
       */}
      <div role="alert">
        <Display as="h1">{t.errors.unexpectedTitle}</Display>
        <Lede className="mt-4">{t.errors.unexpectedBody}</Lede>
      </div>

      <div className="mt-10">
        <Button onClick={reset}>{t.errors.tryAgain}</Button>
      </div>

      {error.digest === undefined ? null : (
        <p className="text-text-muted mt-8 text-[length:var(--type-ui-size-sm)]">
          {t.errors.reference}{' '}
          <span className="font-(family-name:--type-family-data) tabular-nums">{error.digest}</span>
        </p>
      )}
    </main>
  );
}
