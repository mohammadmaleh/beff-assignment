/**
 * The English dictionary, and the shape every other locale must satisfy.
 *
 * Copy is written in the vocabulary of CONTEXT.md - first-pass yield,
 * calendering, formation, capacity retention. A process engineer reading
 * "actionable insights" learns nothing about whether this product knows their
 * job.
 */
/*
 * Deliberately not `as const`. That would narrow every value to its own string
 * literal, and `Dictionary` - which is this object's type - would then demand
 * that the German file contain the English words.
 */
export const en = {
  meta: {
    title: 'Beff - Production intelligence for battery cell manufacturing',
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
    product: 'Product',
    technology: 'Technology',
    // The theme control is a button, so its name is the action it performs
    // rather than the setting it holds. There is no "system" string because
    // there is no longer a system *option*: the page reads the OS preference and
    // follows it until the reader overrides it, which is what "system" meant
    // anyway - it was just asking them to choose the default they already had.
    /** Shaped for `ThemeToggle`'s `labels` prop. */
    theme: { toLight: 'Switch to light appearance', toDark: 'Switch to dark appearance' },
  },

  landing: {
    eyebrow: 'Pre-launch',
    headline: 'Find the scrap before it reaches formation.',
    // The economic argument for the whole product, in one sentence a plant
    // manager would recognise as true.
    subhead:
      'A cell scrapped at formation has already absorbed every upstream cost. Beff shows where first-pass yield is going, at which process step, and what it is worth - from the data your line already produces.',
    ctaPrimary: 'Request access',
    ctaSecondary: 'See what it measures',

    /*
     * The hero is the signature element at full scale, showing one honest
     * reading - the design brief's first instruction, and the thing the first
     * implementation left out. A production line specifies 85–97% first-pass
     * yield (CONTEXT.md); this reading is below that, which is the whole point.
     */
    heroReadingLabel: 'First-pass yield · Line 3 · week 30',
    heroReadingNote:
      'A production line specifies 85 to 97 per cent. This one is losing more than one cell in five before it reaches end-of-line test, and the number alone does not say where.',

    problemTitle: 'The line already has the data. It is in fourteen spreadsheets.',
    problemBody:
      'Coating thickness in one export, formation results in another, scrap logged by shift on paper. By the time the picture assembles, the batch has shipped and the answer is three weeks old.',

    /*
     * Replaces a three-column feature grid - the exact "icon trio" the design
     * brief ruled out. The argument the product rests on is that position in the
     * chain determines cost, and that is a shape, not three paragraphs.
     */
    costTitle: 'Where the value is already committed',
    costBody:
      'Cost accrues along the chain: material, energy and line time go in at every step and none of it comes back out. A cell scrapped at formation carries 90 per cent of its finished cost. The same cell scrapped at coating carries 21 per cent. Reported as percentages, those two losses look identical.',
    costFigureLabel: 'Committed value per cell by process step',
    costFigureDescription:
      'Committed value rises from 7 per cent of finished cell cost at mixing to 100 per cent at end-of-line test, step by step, with the largest single increases at coating, electrolyte filling and formation.',
    costAxisStart: 'Cell started',
    costAxisEnd: 'Cell finished',
    costColumnStep: 'Process step',
    costColumnCommitted: 'Committed value',
    costTableCaption: 'Committed value per cell at each process step, as a share of finished cost',

    /*
     * The brief was written before the product existed and ruled out a
     * screenshot for that reason. There is a product now, so the panel renders
     * the dashboard's own components with the demo line's own figures - not a
     * picture of the product, the product.
     */
    productTitle: 'The view at 08:40',
    productBody:
      'Yield dropped overnight and there is a standup at nine. This is the screen, running the components the application ships, on the figures a pilot line actually produces.',
    productLineLabel: 'Pilot line 1 · last 30 days',
    productNote:
      'Every reading is drawn against its specification window, and every chart has a table behind it.',

    signatureTitle: 'Built around the tolerance band',
    signatureBody:
      'Every measurement in Beff is shown against its specification window, the way a control chart or a calibration certificate already shows it. In spec, out of spec, and by how much - readable at a glance, and readable without colour.',
    signatureExampleLabel: 'Electrode porosity after calendering',

    // The film is Beff's own, and it is about the work the company already does
    // - the expert chat, Navigator, the virtual factory platform. Framing it as
    // the *company's* introduction rather than this product's demo is what keeps
    // it honest: this surface is pre-launch and has nothing to demo.
    filmEyebrow: 'The company',
    filmTitle: 'Beff, in about a minute',
    filmBody:
      'Beff’s own introduction to the work behind this: the expert chat, the Navigator specification workflow, and the virtual factory platform the team already runs with cell manufacturers.',
    filmLabel: 'Beff company introduction film',

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
    // The body is no longer a literal: it comes from `apiErrors.byCode`, keyed
    // by the API's own code, so a rejected request says why it was rejected.
    // The title has to stay true across every one of those - a 409 *did* send,
    // it was refused - so it says "did not work", not "did not send".
    waitlistErrorTitle: 'That did not work',
  },

  footer: {
    tagline: 'Production intelligence for battery cell manufacturing.',
    legal: 'Legal',
    impressum: 'Imprint',
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    accessibility: 'Accessibility',
    company: 'Company',
    about: 'About',
    language: 'Language',
    rights: 'All rights reserved.',
  },

  cookies: {
    title: 'Cookies',
    body: 'We use cookies that are strictly necessary to run this site. We would also like to set analytics cookies to understand which pages are useful - only with your consent, and you can withdraw it at any time.',
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
    termsTitle: 'Terms of use',
    termsNote:
      'For business users, under German law. This is a demonstration project; these terms have not been reviewed by a lawyer.',
    accessibilityTitle: 'Accessibility statement',
    accessibilityNote:
      'Provided under §14 BFSG. Section 3 lists what is not yet accessible - it is the part worth reading.',
    cookieTitle: 'Cookies we set',
    cookieNote:
      'Under §25 TDDDG, anything beyond what is strictly necessary needs your consent. This is the full list.',
    cookieColumnName: 'Name',
    cookieColumnPurpose: 'Purpose',
    cookieColumnDuration: 'Duration',
    cookieColumnCategory: 'Category',
  },

  about: {
    eyebrow: 'About',
    title: 'Built by people who have run the line.',
    lede: 'Beff is an engineering company working with the lithium-ion battery industry - from cell design and prototyping through to scaling mass production. This product is one part of that work, turned into software.',

    originTitle: 'Where this comes from',
    originBody:
      'Beff was founded by engineers who spent years in the lithium-ion battery industry: designing cells, scaling production lines, and navigating international markets first-hand.',
    originBodyTwo:
      'That is the reason this product argues about committed value rather than about percentages. A cell scrapped at formation and a cell scrapped at coating are not the same event, and every dashboard that reports both as a loss percentage is throwing away the thing an engineer on the floor already knows.',

    whereTitle: 'Where we are',
    stuttgart: 'Stuttgart, Germany',
    stuttgartRole: 'European headquarters',
    tokyo: 'Tokyo, Japan',
    tokyoRole: 'Asia-Pacific headquarters',

    prelaunchTitle: 'What is true today',
    prelaunchBody:
      'This product has not launched. There is no paid plan, no customer list and no case study, and inventing any of them would be transparent to anyone who works on a cell line. What there is: a waiting list, an account you can open to look around, and figures throughout this site that stay inside the ranges a real pilot or production line produces.',
  },

  common: {
    loading: 'Loading…',
    required: 'Required',
    dismiss: 'Dismiss',
  },

  /**
   * Strings that are spoken but mostly never seen.
   *
   * These live here rather than inside `packages/ui` because a component
   * library cannot know what language the page is in, and a component that
   * guesses guesses English. The screen-reader pass found the consequence: the
   * German landing page announced its signature element - the tolerance band -
   * entirely in English, because `SpecBand` built its readout from literals.
   * Every one of these is now a required prop with no default, so the compiler
   * catches the next one.
   */
  a11y: {
    /** Spoken before an alert's title, so the tone is not carried by colour alone. */
    alertPrefixes: {
      info: 'Note',
      success: 'Success',
      warning: 'Warning',
      danger: 'Error',
    },
    /** Replaces the ▲ ▼ - glyphs, which are `aria-hidden`. */
    trend: {
      up: 'up',
      down: 'down',
      flat: 'unchanged',
    },
    /**
     * The tolerance band's text readout. The bar is `aria-hidden`, so this is
     * the whole of what a screen reader gets - the verdict in words rather than
     * a description of a drawing.
     */
    specBand: {
      inSpec: 'in spec',
      aboveUpper: 'out of spec, above the upper limit',
      belowLower: 'out of spec, below the lower limit',
      specification: 'Specification',
      target: 'target',
    },
  },

  /**
   * Whole-page failures: a wrong URL, and an unhandled exception inside a route.
   * Distinct from `fieldErrors`, which is about one input being wrong.
   */
  errors: {
    notFoundTitle: 'That page is not here',
    notFoundBody:
      'The link may be out of date, or the address may have a typo in it. Nothing has gone wrong on our side.',
    backHome: 'Back to the start',
    unexpectedTitle: 'Something went wrong',
    unexpectedBody:
      'This is on us, not on you. Trying again often works - the failure may have been momentary.',
    tryAgain: 'Try again',
    reference: 'Reference for support:',
  },

  /**
   * Keyed by the stable `code` the API returns in its RFC 9457 `errors` array,
   * never by parsing its English `detail`. `unknown` is the fallback for a code
   * this build has not seen - a new backend validation rule shows a usable
   * message rather than a blank field.
   */
  fieldErrors: {
    required: 'This field is required.',
    invalid_email: 'That does not look like an email address.',
    already_registered: 'That address is already on the list.',
    too_long: 'That is longer than we can store.',
    too_short: 'That is too short.',
    weak_password: 'Choose a longer password - at least 12 characters.',
    unknown: 'Please check this field.',
  } as Record<string, string>,
};

/** The marketing half of the dictionary. `de.ts` is typed against this. */
export type BaseDictionary = typeof en;
