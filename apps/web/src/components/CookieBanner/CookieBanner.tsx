'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@beff/ui/button';

import { getDictionary, type Locale } from '@/lib/i18n';
import { surfacePath } from '@/lib/navigation';

export const CONSENT_STORAGE_KEY = 'beff-cookie-consent';

export interface CookieConsent {
  analytics: boolean;
  /** The policy version consented to. Consent to an old text is not consent to a new one. */
  policyVersion: string;
  decidedAt: string;
}

const POLICY_VERSION = '2026-07-31';

/**
 * ## Consent, done the way the law actually requires
 *
 * - **Nothing is pre-checked.** Consent must be a positive act (Art. 4(11)
 *   GDPR; Planet49, C-673/17). A pre-ticked box is not consent, and it is the
 *   single most common failure on German sites.
 * - **Reject is as prominent as Accept** — same size, same weight, same visual
 *   treatment. A greyed-out "reject" makes the choice unfree, which makes the
 *   consent invalid.
 * - **Strictly necessary cookies are not offered as a choice**, because they
 *   are not one (§25(2) TDDDG). They are disclosed instead, and the checkbox is
 *   disabled and checked so the disclosure is honest rather than decorative.
 * - Withdrawing is as easy as giving: the same panel reopens from the privacy
 *   page, and the profile surface carries the same control for signed-in users.
 *
 * Rendered only after mount. Server-rendering it would put a consent panel in
 * the static HTML of a page whose reader may have decided months ago.
 */
export function CookieBanner({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [decided, setDecided] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored === null) {
      setDecided(false);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as CookieConsent;
      // A new policy version invalidates the old consent — the user agreed to a
      // different text.
      setDecided(parsed.policyVersion === POLICY_VERSION);
    } catch {
      setDecided(false);
    }
  }, []);

  const decide = (allowAnalytics: boolean): void => {
    const consent: CookieConsent = {
      analytics: allowAnalytics,
      policyVersion: POLICY_VERSION,
      decidedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    setDecided(true);
  };

  if (decided) return null;

  return (
    <section
      // A region, not a modal. It does not trap focus and it does not block the
      // page — a banner that holds the content hostage until you consent is
      // itself a form of pressure.
      aria-label={t.cookies.title}
      className="border-border-default bg-surface-raised fixed inset-x-0 bottom-0 z-50 border-t"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-5">
        <div>
          <h2 className="font-medium">{t.cookies.title}</h2>
          <p className="text-text-muted mt-1 max-w-[var(--type-prose-measure)] text-[length:var(--type-ui-size-sm)]">
            {t.cookies.body}
          </p>
        </div>

        {/*
         * The label holds only the name; the explanation is a sibling wired up
         * with `aria-describedby`. Nesting the note inside the label would fold
         * a whole sentence into the accessible name, so a screen reader would
         * announce "Analytics Anonymous page-view counts. Off unless you turn
         * them on., checkbox, not checked" as one run-on string.
         */}
        <ul className="flex flex-col gap-3">
          <li className="text-[length:var(--type-ui-size-sm)]">
            <div className="flex items-start gap-3">
              <input
                id="cookie-necessary"
                type="checkbox"
                checked
                disabled
                // Disclosed, not offered. §25(2) TDDDG exempts what is strictly
                // necessary from consent; presenting it as a choice would be a
                // lie about how much control the user has.
                readOnly
                aria-describedby="cookie-necessary-note"
                className="mt-1"
              />
              <label htmlFor="cookie-necessary" className="font-medium">
                {t.cookies.necessaryLabel}
              </label>
            </div>
            <p id="cookie-necessary-note" className="text-text-muted ms-7">
              {t.cookies.necessaryNote}
            </p>
          </li>
          <li className="text-[length:var(--type-ui-size-sm)]">
            <div className="flex items-start gap-3">
              <input
                id="cookie-analytics"
                type="checkbox"
                name="analytics"
                checked={analytics}
                onChange={(event) => {
                  setAnalytics(event.target.checked);
                }}
                aria-describedby="cookie-analytics-note"
                className="mt-1"
              />
              <label htmlFor="cookie-analytics" className="font-medium">
                {t.cookies.analyticsLabel}
              </label>
            </div>
            <p id="cookie-analytics-note" className="text-text-muted ms-7">
              {t.cookies.analyticsNote}
            </p>
          </li>
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          {/*
           * Identical variant and size. Making "reject" quieter than "accept"
           * is the pattern regulators single out, and it is trivially visible
           * to anyone looking for it.
           */}
          <Button
            variant="secondary"
            onClick={() => {
              decide(false);
            }}
          >
            {t.cookies.reject}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              decide(analytics);
            }}
          >
            {t.cookies.save}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              decide(true);
            }}
          >
            {t.cookies.accept}
          </Button>
          <Link
            href={surfacePath('privacy', locale)}
            className="text-[length:var(--type-ui-size-sm)] underline underline-offset-4"
          >
            {t.cookies.moreInfo}
          </Link>
        </div>
      </div>
    </section>
  );
}
