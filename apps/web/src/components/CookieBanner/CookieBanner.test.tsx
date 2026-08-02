import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { CONSENT_STORAGE_KEY, CookieBanner, type CookieConsent } from './CookieBanner';

/**
 * The version the component currently ships. Deliberately duplicated rather
 * than imported: this is the value a *stored* consent is compared against, so a
 * test that read it from the component would keep passing if the comparison
 * were removed.
 */
const CURRENT_POLICY_VERSION = '2026-07-31';

const store = (consent: Partial<CookieConsent>): void => {
  window.localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({
      analytics: false,
      policyVersion: CURRENT_POLICY_VERSION,
      decidedAt: '2026-07-31T09:00:00.000Z',
      ...consent,
    }),
  );
};

const stored = (): CookieConsent =>
  JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY) ?? 'null') as CookieConsent;

/** The banner is rendered only after mount, so every appearance is awaited. */
const banner = () => screen.findByRole('region', { name: 'Cookies' });

describe('CookieBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('when to ask', () => {
    it('asks a visitor who has never decided', async () => {
      render(<CookieBanner locale="en" />);
      expect(await banner()).toBeInTheDocument();
    });

    it('does not ask again once a decision exists', async () => {
      store({ analytics: true });
      render(<CookieBanner locale="en" />);

      await waitFor(() => {
        expect(screen.queryByRole('region', { name: 'Cookies' })).not.toBeInTheDocument();
      });
    });

    it('asks again when the policy text has changed', async () => {
      // Consent to an old text is not consent to a new one — the user agreed to
      // something that no longer describes what happens.
      store({ analytics: true, policyVersion: '2026-01-01' });
      render(<CookieBanner locale="en" />);

      expect(await banner()).toBeInTheDocument();
    });

    it('asks again rather than assuming consent when the stored value is corrupt', async () => {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, 'not json{');
      render(<CookieBanner locale="en" />);

      expect(await banner()).toBeInTheDocument();
    });

    it('is a region and not a modal, so it cannot hold the page hostage', async () => {
      // A banner that blocks the content until you consent is itself a form of
      // pressure, which makes the consent unfree.
      render(<CookieBanner locale="en" />);
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
      render(<CookieBanner locale="en" />);
      await banner();

      expect(screen.getByRole('checkbox', { name: 'Analytics' })).not.toBeChecked();
    });

    it('discloses the strictly necessary cookies instead of offering them as a choice', async () => {
      // §25(2) TDDDG exempts them from consent. Presenting them as a choice
      // would be a lie about how much control the user has.
      render(<CookieBanner locale="en" />);
      await banner();

      const necessary = screen.getByRole('checkbox', { name: 'Strictly necessary' });
      expect(necessary).toBeChecked();
      expect(necessary).toBeDisabled();
    });

    it('gives reject exactly the weight accept has', async () => {
      // Same variant, same size, same classes. A quieter "reject" is the
      // pattern regulators single out.
      render(<CookieBanner locale="en" />);
      await banner();

      const reject = screen.getByRole('button', { name: 'Reject analytics' });
      const accept = screen.getByRole('button', { name: 'Accept analytics' });
      expect(reject.className).toBe(accept.className);
    });

    it('describes each option without folding the explanation into its name', async () => {
      // Nesting the note inside the label would make a screen reader announce
      // "Analytics Anonymous page-view counts. Off unless you turn them on.,
      // checkbox, not checked" as one run-on string.
      render(<CookieBanner locale="en" />);
      await banner();

      const analytics = screen.getByRole('checkbox', { name: 'Analytics' });
      expect(analytics).toHaveAccessibleDescription(
        'Anonymous page-view counts. Off unless you turn them on.',
      );
    });

    it('links to the full policy so the choice is informed', async () => {
      render(<CookieBanner locale="de" />);
      await screen.findByRole('region', { name: 'Cookies' });

      expect(screen.getByRole('link', { name: 'Datenschutzerklärung lesen' })).toHaveAttribute(
        'href',
        '/de/datenschutz',
      );
    });
  });

  describe('recording the decision', () => {
    it('records a refusal, so it is not asked again', async () => {
      render(<CookieBanner locale="en" />);
      await banner();

      await userEvent.click(screen.getByRole('button', { name: 'Reject analytics' }));

      expect(stored().analytics).toBe(false);
      expect(screen.queryByRole('region', { name: 'Cookies' })).not.toBeInTheDocument();
    });

    it('ignores the checkbox when the visitor rejects outright', async () => {
      // Ticking analytics and then pressing "reject" is a refusal, not a grant.
      render(<CookieBanner locale="en" />);
      await banner();

      await userEvent.click(screen.getByRole('checkbox', { name: 'Analytics' }));
      await userEvent.click(screen.getByRole('button', { name: 'Reject analytics' }));

      expect(stored().analytics).toBe(false);
    });

    it('saves exactly what the checkboxes say', async () => {
      render(<CookieBanner locale="en" />);
      await banner();

      await userEvent.click(screen.getByRole('checkbox', { name: 'Analytics' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save choices' }));

      expect(stored().analytics).toBe(true);
    });

    it('saves a refusal when nothing was ticked', async () => {
      render(<CookieBanner locale="en" />);
      await banner();

      await userEvent.click(screen.getByRole('button', { name: 'Save choices' }));

      expect(stored().analytics).toBe(false);
    });

    it('records what was consented to and when, not just that it happened', async () => {
      // The version is what makes the record provable: without it there is no
      // way to say which text the user agreed to.
      render(<CookieBanner locale="en" />);
      await banner();

      await userEvent.click(screen.getByRole('button', { name: 'Accept analytics' }));

      const consent = stored();
      expect(consent.analytics).toBe(true);
      expect(consent.policyVersion).toBe(CURRENT_POLICY_VERSION);
      expect(new Date(consent.decidedAt).getTime()).not.toBeNaN();
    });
  });

  it('speaks German on the German site', async () => {
    render(<CookieBanner locale="de" />);
    await screen.findByRole('region', { name: 'Cookies' });

    expect(screen.getByRole('checkbox', { name: 'Analyse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyse ablehnen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyse zulassen' })).toBeInTheDocument();
  });
});
