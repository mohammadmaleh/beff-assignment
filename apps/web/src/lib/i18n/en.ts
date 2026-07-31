/**
 * The English dictionary, and the shape every other locale must satisfy.
 *
 * Copy is written in the vocabulary of CONTEXT.md — first-pass yield,
 * calendering, formation, capacity retention. A process engineer reading
 * "actionable insights" learns nothing about whether this product knows their
 * job.
 */
/*
 * Deliberately not `as const`. That would narrow every value to its own string
 * literal, and `Dictionary` — which is this object's type — would then demand
 * that the German file contain the English words.
 */
export const en = {
  meta: {
    title: 'Beff — Production intelligence for battery cell manufacturing',
    description:
      'See where first-pass yield is lost, what it costs in scrap, and what it means for CO₂ per kWh. Built for pilot and production cell lines.',
    localeName: 'English',
    switchTo: 'Auf Deutsch ansehen',
  },

  nav: {
    skipToContent: 'Skip to main content',
    dashboard: 'Dashboard',
    profile: 'Profile',
    logIn: 'Log in',
    logOut: 'Log out',
    getStarted: 'Request access',
    primary: 'Main',
    theme: 'Appearance',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
  },

  landing: {
    eyebrow: 'Pre-launch',
    headline: 'Find the scrap before it reaches formation.',
    // The economic argument for the whole product, in one sentence a plant
    // manager would recognise as true.
    subhead:
      'A cell scrapped at formation has already absorbed every upstream cost. Beff shows where first-pass yield is going, at which process step, and what it is worth — from the data your line already produces.',
    ctaPrimary: 'Request access',
    ctaSecondary: 'See what it measures',

    problemTitle: 'The line already has the data. It is in fourteen spreadsheets.',
    problemBody:
      'Coating thickness in one export, formation results in another, scrap logged by shift on paper. By the time the picture assembles, the batch has shipped and the answer is three weeks old.',

    valueTitle: 'What you get',
    values: [
      {
        title: 'Yield, by process step',
        body: 'First-pass yield broken down across mixing through end-of-line test, weighted so late-stage losses read as the expensive ones they are.',
      },
      {
        title: 'Scrap in euros, not percentages',
        body: 'A 2% loss at calendering and a 2% loss at formation are not the same event. Scrap is costed against the value already committed at that step.',
      },
      {
        title: 'CO₂ per kWh, tracked',
        body: 'Emissions intensity per unit energy produced, moving with your actual yield — the number your customers are starting to ask for in writing.',
      },
    ],

    signatureTitle: 'Built around the tolerance band',
    signatureBody:
      'Every measurement in Beff is shown against its specification window, the way a control chart or a calibration certificate already shows it. In spec, out of spec, and by how much — readable at a glance, and readable without colour.',
    signatureExampleLabel: 'Electrode porosity after calendering',

    waitlistTitle: 'Request access',
    waitlistBody:
      'We are onboarding pilot lines first. Tell us where you are and we will get in touch.',
    waitlistEmailLabel: 'Work email',
    waitlistEmailDescription: 'We use this to contact you about access. Nothing else.',
    waitlistCompanyLabel: 'Company',
    waitlistSubmit: 'Request access',
    waitlistSubmitting: 'Sending your request…',
    waitlistSuccessTitle: 'Request received',
    waitlistSuccessBody: 'We will be in touch at the address you gave us.',
    waitlistErrorTitle: 'That did not send',
    waitlistErrorBody: 'Something went wrong on our side. Please try again in a moment.',
  },

  footer: {
    tagline: 'Production intelligence for battery cell manufacturing.',
    legal: 'Legal',
    impressum: 'Imprint',
    privacy: 'Privacy policy',
    language: 'Language',
    rights: 'All rights reserved.',
  },

  cookies: {
    title: 'Cookies',
    body: 'We use cookies that are strictly necessary to run this site. We would also like to set analytics cookies to understand which pages are useful — only with your consent, and you can withdraw it at any time.',
    necessaryLabel: 'Strictly necessary',
    necessaryNote: 'Required to log in and keep you logged in. These cannot be switched off.',
    analyticsLabel: 'Analytics',
    analyticsNote: 'Anonymous page-view counts. Off unless you turn them on.',
    accept: 'Accept analytics',
    reject: 'Reject analytics',
    save: 'Save choices',
    moreInfo: 'Read the privacy policy',
  },

  legal: {
    impressumTitle: 'Imprint',
    impressumNote:
      'Provided under §5 DDG. This is a demonstration project; the details below are placeholders.',
    privacyTitle: 'Privacy policy',
    privacyNote:
      'Provided under Art. 13 GDPR. This is a demonstration project; the details below are placeholders.',
  },

  common: {
    loading: 'Loading…',
    required: 'Required',
    dismiss: 'Dismiss',
  },

  /**
   * Keyed by the stable `code` the API returns in its RFC 9457 `errors` array,
   * never by parsing its English `detail`. `unknown` is the fallback for a code
   * this build has not seen — a new backend validation rule shows a usable
   * message rather than a blank field.
   */
  fieldErrors: {
    required: 'This field is required.',
    invalid_email: 'That does not look like an email address.',
    already_registered: 'That address is already on the list.',
    too_long: 'That is longer than we can store.',
    too_short: 'That is too short.',
    weak_password: 'Choose a longer password — at least 12 characters.',
    unknown: 'Please check this field.',
  } as Record<string, string>,
};

/** The marketing half of the dictionary. `de.ts` is typed against this. */
export type BaseDictionary = typeof en;
