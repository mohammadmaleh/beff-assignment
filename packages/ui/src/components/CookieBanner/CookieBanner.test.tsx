import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CookieBanner, type CookieConsent } from './CookieBanner';

/**
 * The key and the policy version are the *caller's*, and the tests supply their
 * own rather than importing the app's — which is the point of the component
 * taking them. A consent record is evidence, and evidence that says "the
 * version the code happened to hold" proves nothing.
 */
const STORAGE_KEY = 'test-cookie-consent';
const POLICY_VERSION = '2026-07-31';

/**
 * Copy fixtures, in both shipped locales.
 *
 * Written out here rather than imported from an app dictionary. This package
 * has no dictionary and must not grow one — the whole reason every string is a
 * required prop is that a component library cannot know the page's language,
 * and a test that reached for the app's would quietly re-couple them.
 */
const EN = {
  title: 'Cookies',
  body: 'We use cookies that are strictly necessary to run this site.',
  necessaryLabel: 'Strictly necessary',
  necessaryNote: 'Required to log in and keep you logged in. These cannot be switched off.',
  analyticsLabel: 'Analytics',
  analyticsNote: 'Anonymous page-view counts. Off unless you turn them on.',
  accept: 'Accept analytics',
  reject: 'Reject analytics',
  save: 'Save choices',
};

const DE = {
  title: 'Cookies',
  body: 'Wir verwenden Cookies, die für den Betrieb dieser Website unbedingt erforderlich sind.',
  necessaryLabel: 'Unbedingt erforderlich',
  necessaryNote: 'Erforderlich für die Anmeldung. Diese können nicht abgeschaltet werden.',
  analyticsLabel: 'Analyse',
  analyticsNote: 'Anonyme Seitenaufrufe. Standardmäßig aus.',
  accept: 'Analyse zulassen',
  reject: 'Analyse ablehnen',
  save: 'Auswahl speichern',
};

const PRIVACY_LINK = <a href="/de/datenschutz">Datenschutzerklärung lesen</a>;

function renderBanner(
  props: Partial<React.ComponentProps<typeof CookieBanner>> = {},
): ReturnType<typeof render> {
  return render(
    <CookieBanner
      copy={EN}
      policyVersion={POLICY_VERSION}
      storageKey={STORAGE_KEY}
      privacyLink={PRIVACY_LINK}
      {...props}
    />,
  );
}

const store = (consent: Partial<CookieConsent>): void => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      analytics: false,
      policyVersion: POLICY_VERSION,
      decidedAt: '2026-07-31T09:00:00.000Z',
      ...consent,
    }),
  );
};

const stored = (): CookieConsent =>
  JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as CookieConsent;

/** The banner is rendered only after mount, so every appearance is awaited. */
const banner = () => screen.findByRole('region', { name: 'Cookies' });

describe('CookieBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('when to ask', () => {
    it('asks a visitor who has never decided', async () => {
      renderBanner();
      expect(await banner()).toBeInTheDocument();
    });

    it('does not ask again once a decision exists', async () => {
      store({ analytics: true });
      renderBanner();

      await waitFor(() => {
        expect(screen.queryByRole('region', { name: 'Cookies' })).not.toBeInTheDocument();
      });
    });

    it('asks again when the policy text has changed', async () => {
      // Consent to an old text is not consent to a new one — the user agreed to
      // something that no longer describes what happens.
      store({ analytics: true, policyVersion: '2026-01-01' });
      renderBanner();

      expect(await banner()).toBeInTheDocument();
    });

    it('asks again rather than assuming consent when the stored value is corrupt', async () => {
      window.localStorage.setItem(STORAGE_KEY, 'not json{');
      renderBanner();

      expect(await banner()).toBeInTheDocument();
    });

    it('is a region and not a modal, so it cannot hold the page hostage', async () => {
      // A banner that blocks the content until you consent is itself a form of
      // pressure, which makes the consent unfree.
      renderBanner();
      const region = await banner();

      expect(region.tagName).toBe('SECTION');
      expect(region).not.toHaveAttribute('role', 'dialog');
      expect(region).not.toHaveAttribute('aria-modal');
    });
  });

  describe('the choice itself', () => {
    it('pre-checks nothing — consent has to be a positive act', async () => {
      // Art. 4(11) GDPR, and Planet49 (C-673/17). A pre-ticked box is the single
      // most common consent failure on German sites.
      renderBanner();
      await banner();

      expect(screen.getByRole('checkbox', { name: 'Analytics' })).not.toBeChecked();
    });

    it('discloses the strictly necessary cookies instead of offering them as a choice', async () => {
      // §25(2) TDDDG exempts them from consent. Presenting them as a choice
      // would be a lie about how much control the user has.
      renderBanner();
      await banner();

      const necessary = screen.getByRole('checkbox', { name: 'Strictly necessary' });
      expect(necessary).toBeChecked();
      expect(necessary).toBeDisabled();
    });

    it('gives reject exactly the weight accept has', async () => {
      // Same variant, same size, same classes. A quieter "reject" is the
      // pattern regulators single out.
      renderBanner();
      await banner();

      const reject = screen.getByRole('button', { name: 'Reject analytics' });
      const accept = screen.getByRole('button', { name: 'Accept analytics' });
      expect(reject.className).toBe(accept.className);
    });

    it('describes each option without folding the explanation into its name', async () => {
      // Nesting the note inside the label would make a screen reader announce
      // "Analytics Anonymous page-view counts. Off unless you turn them on.,
      // checkbox, not checked" as one run-on string.
      renderBanner();
      await banner();

      const analytics = screen.getByRole('checkbox', { name: 'Analytics' });
      expect(analytics).toHaveAccessibleDescription(
        'Anonymous page-view counts. Off unless you turn them on.',
      );
    });

    it('renders the caller’s own policy link, whole', async () => {
      // A `ReactNode` and not an `href`, so this package needs no router. The
      // app hands over its framework's own link and keeps client-side
      // navigation; a design system that imported `next/link` for one legal
      // link would be a Next-only design system.
      renderBanner({ copy: DE });
      await banner();

      expect(screen.getByRole('link', { name: 'Datenschutzerklärung lesen' })).toHaveAttribute(
        'href',
        '/de/datenschutz',
      );
    });
  });

  describe('recording the decision', () => {
    it('records a refusal, so it is not asked again', async () => {
      renderBanner();
      await banner();

      await userEvent.click(screen.getByRole('button', { name: 'Reject analytics' }));

      expect(stored().analytics).toBe(false);
      expect(screen.queryByRole('region', { name: 'Cookies' })).not.toBeInTheDocument();
    });

    it('ignores the checkbox when the visitor rejects outright', async () => {
      // Ticking analytics and then pressing "reject" is a refusal, not a grant.
      renderBanner();
      await banner();

      await userEvent.click(screen.getByRole('checkbox', { name: 'Analytics' }));
      await userEvent.click(screen.getByRole('button', { name: 'Reject analytics' }));

      expect(stored().analytics).toBe(false);
    });

    it('saves exactly what the checkboxes say', async () => {
      renderBanner();
      await banner();

      await userEvent.click(screen.getByRole('checkbox', { name: 'Analytics' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save choices' }));

      expect(stored().analytics).toBe(true);
    });

    it('saves a refusal when nothing was ticked', async () => {
      renderBanner();
      await banner();

      await userEvent.click(screen.getByRole('button', { name: 'Save choices' }));

      expect(stored().analytics).toBe(false);
    });

    it('records what was consented to and when, not just that it happened', async () => {
      // The version is what makes the record provable: without it there is no
      // way to say which text the user agreed to.
      renderBanner();
      await banner();

      await userEvent.click(screen.getByRole('button', { name: 'Accept analytics' }));

      const consent = stored();
      expect(consent.analytics).toBe(true);
      expect(consent.policyVersion).toBe(POLICY_VERSION);
      expect(new Date(consent.decidedAt).getTime()).not.toBeNaN();
    });

    it('tells the caller, once, so analytics can actually be loaded', async () => {
      // The decision is useless to the app if it only lands in localStorage —
      // something has to switch the tag on. Fired on a fresh decision only.
      const onDecide = vi.fn();
      renderBanner({ onDecide });
      await banner();

      await userEvent.click(screen.getByRole('button', { name: 'Accept analytics' }));

      expect(onDecide).toHaveBeenCalledTimes(1);
      expect(onDecide.mock.calls[0]?.[0]).toMatchObject({ analytics: true });
    });

    it('does not re-announce a decision made on an earlier visit', async () => {
      const onDecide = vi.fn();
      store({ analytics: true });
      renderBanner({ onDecide });

      await waitFor(() => {
        expect(screen.queryByRole('region', { name: 'Cookies' })).not.toBeInTheDocument();
      });
      expect(onDecide).not.toHaveBeenCalled();
    });
  });

  it('speaks whatever language the caller hands it', async () => {
    // Consent obtained through text the reader could not understand is not
    // consent. Nothing here is defaulted, so there is no path by which an
    // English string reaches a German page.
    renderBanner({ copy: DE });
    await banner();

    expect(screen.getByRole('checkbox', { name: 'Analyse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyse ablehnen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyse zulassen' })).toBeInTheDocument();
  });
});
