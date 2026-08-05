'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '../Button/index';
import { Lede } from '../Lede/index';

export interface CookieConsent {
  analytics: boolean;
  /** The policy version consented to. Consent to an old text is not consent to a new one. */
  policyVersion: string;
  decidedAt: string;
}

/**
 * Every string the banner shows. All required, none defaulted — the rule this
 * library arrived at after `SpecBand` composed its readout from English
 * literals and the German landing page announced the product's signature
 * element entirely in English. A component library cannot know the page's
 * language, so a default *is* a guess, and it ships.
 *
 * It matters more here than anywhere else in the package: consent obtained
 * through text the user could not read is not consent.
 */
export interface CookieBannerCopy {
  title: string;
  body: string;
  necessaryLabel: string;
  necessaryNote: string;
  analyticsLabel: string;
  analyticsNote: string;
  accept: string;
  reject: string;
  save: string;
}

export interface CookieBannerProps {
  copy: CookieBannerCopy;
  /**
   * The version of the policy text this banner is asking about.
   *
   * Owned by the app, because the *text* is. Stored with the decision, and a
   * change to it re-opens the banner: consent to an old text is not consent to
   * a new one, and treating it as such is the failure that makes a consent
   * record worthless as evidence.
   */
  policyVersion: string;
  /**
   * The link to the full policy, supplied whole.
   *
   * A `ReactNode` rather than an `href`, so this package needs no router and no
   * framework. The app passes its own `<Link>` and keeps client-side
   * navigation; a design system that imported `next/link` for one legal link
   * would be a Next-only design system.
   */
  privacyLink: ReactNode;
  /** Where the decision is persisted. Namespaced by the app, since the origin is shared. */
  storageKey: string;
  /**
   * A decision recorded, for a caller that wants to act on it — load analytics,
   * write an audit row. Fired only on a fresh decision, never on replay.
   */
  onDecide?: (consent: CookieConsent) => void;
}

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
export function CookieBanner({
  copy,
  policyVersion,
  privacyLink,
  storageKey,
  onDecide,
}: CookieBannerProps) {
  const [decided, setDecided] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) {
      setDecided(false);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as CookieConsent;
      // A new policy version invalidates the old consent — the user agreed to a
      // different text.
      setDecided(parsed.policyVersion === policyVersion);
    } catch {
      setDecided(false);
    }
  }, [storageKey, policyVersion]);

  const decide = (allowAnalytics: boolean): void => {
    const consent: CookieConsent = {
      analytics: allowAnalytics,
      policyVersion,
      decidedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(storageKey, JSON.stringify(consent));
    setDecided(true);
    onDecide?.(consent);
  };

  if (decided) return null;

  return (
    <section
      // A region, not a modal. It does not trap focus and it does not block the
      // page — a banner that holds the content hostage until you consent is
      // itself a form of pressure.
      aria-label={copy.title}
      className="border-border-default bg-surface-raised fixed inset-x-0 bottom-0 z-50 border-t"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-5">
        <div>
          <h2 className="font-medium">{copy.title}</h2>
          <Lede size="sm" className="mt-1">
            {copy.body}
          </Lede>
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
                {copy.necessaryLabel}
              </label>
            </div>
            <p id="cookie-necessary-note" className="text-text-muted ms-7">
              {copy.necessaryNote}
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
                {copy.analyticsLabel}
              </label>
            </div>
            <p id="cookie-analytics-note" className="text-text-muted ms-7">
              {copy.analyticsNote}
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
            {copy.reject}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              decide(analytics);
            }}
          >
            {copy.save}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              decide(true);
            }}
          >
            {copy.accept}
          </Button>
          {privacyLink}
        </div>
      </div>
    </section>
  );
}
