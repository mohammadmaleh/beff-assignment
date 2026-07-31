/**
 * Auth, onboarding, dashboard and profile copy.
 *
 * Split out of `en.ts` because that file was already the length this repo
 * splits at, and because these strings change with the app surfaces while the
 * landing copy changes with positioning.
 */
export const enApp = {
  auth: {
    loginTitle: 'Log in',
    loginSubtitle: 'Pick up where the line left off.',
    registerTitle: 'Create your account',
    registerSubtitle: 'One account per person. Plants and lines come next.',
    emailLabel: 'Work email',
    passwordLabel: 'Password',
    passwordHint: 'At least 12 characters. Length beats punctuation.',
    nameLabel: 'Name',
    submitLogin: 'Log in',
    submitRegister: 'Create account',
    submittingLogin: 'Logging you in…',
    submittingRegister: 'Creating your account…',
    noAccount: 'No account yet?',
    haveAccount: 'Already have an account?',
    toRegister: 'Create one',
    toLogin: 'Log in',
    failedTitle: 'That did not work',
    invalidCredentials: 'That email and password do not match an account.',
    genericFailure: 'Something went wrong on our side. Please try again.',
  },

  onboarding: {
    title: 'Set up your line',
    resumeNotice: 'Picked up where you left off.',
    stepOf: 'Step {current} of {total}',
    next: 'Continue',
    back: 'Back',
    finish: 'Finish setup',
    finishing: 'Saving your setup…',
    steps: {
      role: {
        title: 'What do you do?',
        body: 'This decides what the dashboard leads with.',
        label: 'Your role',
        options: {
          process_engineer: 'Process engineer',
          quality_engineer: 'Quality engineer',
          production_manager: 'Production manager',
          other: 'Something else',
        },
      },
      plant: {
        title: 'Where is the line?',
        body: 'One plant to start. You can add more later.',
        nameLabel: 'Plant name',
        countryLabel: 'Country',
      },
      line: {
        title: 'Which line?',
        body: 'A pilot line is expected to run lower yield than a production line, and the dashboard will judge it accordingly.',
        nameLabel: 'Line name',
        kindLabel: 'Line type',
        kindPilot: 'Pilot line',
        kindProduction: 'Production line',
        formatLabel: 'Cell format',
        formatPouch: 'Pouch',
        formatPrismatic: 'Prismatic',
        formatCylindrical: 'Cylindrical',
      },
    },
  },

  dashboard: {
    title: 'Production overview',
    subtitle: 'Last 30 days',
    loading: 'Loading production figures',
    errorTitle: 'Could not load production figures',
    emptyTitle: 'No batches recorded yet',
    emptyBody: 'Once the line reports its first batch, this fills in.',
    metrics: {
      fpy: 'First-pass yield',
      scrap: 'Scrap rate',
      retention: 'Capacity retention at 1000 cycles',
      co2: 'CO₂ intensity',
    },
    scrapTitle: 'Where the scrap happened',
    scrapBody:
      'Ordered by process step. A cell lost at formation has absorbed every upstream cost, so late-stage losses are the expensive ones.',
    scrapTableCaption: 'Scrap rate by process step',
    columnStep: 'Process step',
    columnScrap: 'Scrap rate',
    columnCost: 'Committed value lost',
    showTable: 'Show the data as a table',
    hideTable: 'Hide the table',
    bandsTitle: 'Process parameters against specification',
    steps: {
      mixing: 'Mixing',
      coating: 'Coating',
      drying: 'Drying',
      calendering: 'Calendering',
      slitting: 'Slitting',
      die_cutting: 'Die cutting',
      stacking: 'Stacking / winding',
      welding: 'Tab welding',
      filling: 'Electrolyte filling',
      formation: 'Formation',
      aging: 'Aging',
      eol_test: 'End-of-line test',
    },
  },

  profile: {
    title: 'Your account',
    detailsTitle: 'Details',
    consentTitle: 'Consent',
    consentBody:
      'Withdrawing is as easy as giving. Consent records are append-only — we keep the history so we can prove what you agreed to and when, which is itself a legal obligation.',
    consentAnalytics: 'Analytics cookies',
    consentMarketing: 'Product emails',
    consentSaving: 'Saving your choice…',
    consentSaved: 'Saved',
    exportTitle: 'Take your data with you',
    exportBody:
      'A machine-readable copy of everything attached to your account (Art. 15 and Art. 20). Password hashes and other people’s data are never included. We prepare it in the background and it appears here when it is ready.',
    exportRequest: 'Request an export',
    exportRequesting: 'Requesting your export…',
    exportPending: 'Preparing your export. This page updates when it is ready.',
    exportReady: 'Your export is ready.',
    exportDownload: 'Download',
    exportFailed: 'That export failed to build. Requesting a new one is safe.',
    dangerTitle: 'Delete your account',
    dangerBody:
      'This erases your account and everything attached to it (Art. 17). It cannot be undone, and the email address becomes free to register again.',
    dangerConfirmLabel: 'Type DELETE to confirm',
    dangerConfirmWord: 'DELETE',
    dangerSubmit: 'Delete my account permanently',
    dangerSubmitting: 'Deleting your account…',
    dangerMismatch: 'Type DELETE exactly to confirm.',
  },
};
