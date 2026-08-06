import { CookieBanner } from './CookieBanner';

import type { CookieBannerCopy } from './CookieBanner';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';

const EN: CookieBannerCopy = {
  title: 'Cookies',
  body: 'We use cookies that are strictly necessary to run this site. We would also like to set analytics cookies to understand which pages are useful - only with your consent, and you can withdraw it at any time.',
  necessaryLabel: 'Strictly necessary',
  necessaryNote: 'Required to log in and keep you logged in. These cannot be switched off.',
  analyticsLabel: 'Analytics',
  analyticsNote: 'Anonymous page-view counts. Off unless you turn them on.',
  accept: 'Accept analytics',
  reject: 'Reject analytics',
  save: 'Save choices',
};

const DE: CookieBannerCopy = {
  title: 'Cookies',
  body: 'Wir verwenden Cookies, die für den Betrieb dieser Website unbedingt erforderlich sind. Analyse-Cookies setzen wir nur mit Ihrer Einwilligung, die Sie jederzeit widerrufen können.',
  necessaryLabel: 'Unbedingt erforderlich',
  necessaryNote:
    'Erforderlich für die Anmeldung und um Sie angemeldet zu halten. Diese können nicht abgeschaltet werden.',
  analyticsLabel: 'Analyse',
  analyticsNote: 'Anonyme Seitenaufrufe. Standardmäßig aus.',
  accept: 'Analyse zulassen',
  reject: 'Analyse ablehnen',
  save: 'Auswahl speichern',
};

/**
 * Each story asks fresh. Otherwise the first Accept hides the banner for every
 * story after it and the explorer looks broken. Named and typed for the same
 * TS2742 reason as `ThemeToggle`'s.
 */
const askFresh: Decorator = (Story) => {
  window.localStorage.removeItem('storybook-cookie-consent');
  return <Story />;
};

/**
 * Consent, done the way the law actually requires.
 *
 * - **Nothing is pre-checked.** Consent must be a positive act (Art. 4(11)
 *   GDPR; Planet49, C-673/17). A pre-ticked box is not consent, and it is the
 *   single most common failure on German sites.
 * - **Reject is as prominent as Accept** - same variant, same size, same
 *   classes. A greyed-out "reject" makes the choice unfree, which makes the
 *   consent invalid.
 * - **Strictly necessary cookies are disclosed, not offered**, because they are
 *   not a choice (§25(2) TDDDG). The checkbox is checked and disabled so the
 *   disclosure is honest rather than decorative.
 * - It is a **region, not a modal**: no focus trap, no blocked page. A banner
 *   that holds the content hostage until you consent is itself a form of
 *   pressure.
 *
 * ## Why it is in the design system
 *
 * None of the above is about battery cells. It is EU consent plumbing, and the
 * three things that *were* project-specific are now props: the copy, the policy
 * version, and the link to the full policy - handed over as a `ReactNode` so
 * this package needs no router and stays framework-agnostic.
 *
 * ## Storybook note
 *
 * The banner only appears when no decision is stored, so each story clears its
 * own key first. That is the component's real behaviour, not a fixture: it
 * renders after mount precisely so a static page never ships a consent panel to
 * a reader who decided months ago.
 */
const meta = {
  title: 'Privacy/CookieBanner',
  component: CookieBanner,
  parameters: { layout: 'fullscreen' },
  args: {
    copy: EN,
    policyVersion: '2026-07-31',
    storageKey: 'storybook-cookie-consent',
    privacyLink: (
      <a
        href="#privacy"
        className="text-[length:var(--type-ui-size-sm)] underline underline-offset-4"
      >
        Read the privacy policy
      </a>
    ),
  },
  decorators: [askFresh],
} satisfies Meta<typeof CookieBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Note what is *not* here: no pre-ticked analytics box, no "Accept all" that is
 * larger or louder than "Reject", and no X in the corner that dismisses without
 * recording anything.
 */
export const Default: Story = {};

/**
 * German is a shipped locale for this product, and the strings run roughly 30%
 * longer - which is what decides whether the four controls stay on one line.
 * Every string is a required prop with no default, so there is no path by which
 * an English word reaches this panel.
 */
export const German: Story = { args: { copy: DE } };

/**
 * The decision handed back to the caller, which is what makes it actionable -
 * a consent that only reaches `localStorage` never switches an analytics tag
 * on. Open the Actions panel and press any of the three buttons.
 */
export const ReportsTheDecision: Story = {
  args: { onDecide: (consent) => console.info('consent', consent) },
};
