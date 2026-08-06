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
  },

  /**
   * Keyed by the API's top-level RFC 9457 `code`, the same way `fieldErrors` is
   * keyed by the per-field one. The backend says as much in its own docstring:
   * the code is the contract, the English `detail` beside it is for a log.
   *
   * `unknownFailure` is the fallback, and it is deliberately the *only* place a
   * vague sentence lives. Anything the API can distinguish, this file
   * distinguishes — an error naming the wrong recovery ("try again" to someone
   * who already has an account) is worse than one naming none.
   */
  apiErrors: {
    /**
     * Outside `byCode` on purpose: it must always resolve, and an index into a
     * `Record<string, string>` is `string | undefined` under this tsconfig. A
     * fallback the types say might be missing is not a fallback.
     */
    unknownFailure: 'Something went wrong on our side. Please try again.',

    byCode: {
      'auth.invalid_credentials': 'That email and password do not match an account.',
      'auth.email_already_registered':
        'That email address already has an account. Log in instead, or use a different address.',
      'auth.email_already_verified': 'That address has already been confirmed.',
      'auth.refresh_token_expired': 'Your session has expired. Please log in again.',
      'auth.refresh_token_reused':
        'You were signed out for your security, because an expired session was reused. Please log in again.',
      'auth.verification_token_expired': 'That confirmation link has expired. Request a new one.',
      'auth.verification_token_invalid':
        'That confirmation link is not valid, or it has already been used.',
      rate_limit_exceeded: 'Too many attempts. Please wait a moment before trying again.',
      validation_error: 'Please check the details you entered.',
    } as Record<string, string>,
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
        /*
         * The picker's own strings, including the two that only a screen
         * reader ever utters. `@beff/ui` refuses to default any of them — it
         * cannot know this page's language, so a default would be a guess, and
         * a guess in a live region is invisible to axe and to every screenshot.
         */
        country: {
          placeholder: 'Search countries',
          noResults: 'No country matches that',
          toggleLabel: 'Show countries',
          resultsAnnouncement: '{count} countries available',
          selectionAnnouncement: '{country} selected',
        },
      },
      lines: {
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
      units: {
        title: 'Which units?',
        body: 'Applies to every figure on the dashboard. You can change it later.',
        label: 'Unit system',
        metric: 'Metric (mm, kg, °C)',
        imperial: 'Imperial (in, lb, °F)',
      },
      review: {
        title: 'Check this over',
        body: 'Nothing here is permanent — you can change any of it from your profile afterwards.',
        label: 'Your setup',
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
    deltaNote: 'versus the previous period',
    metrics: {
      fpy: 'First-pass yield',
      scrap: 'Scrap rate',
      retention: 'Capacity retention at 1000 cycles',
      co2: 'CO₂ intensity',
    },
    readingsTitle: 'Where the line stands today',
    /*
     * These `…Body` strings are no longer paragraphs on the page — they are the
     * content of an `InfoHint` at the end of each heading.
     *
     * The dashboard is read by people who already know what first-pass yield
     * is, and a paragraph under every heading spent the widest, most valuable
     * space on the page on the reader who needed it least. Behind an icon the
     * explanation still exists for the reader arriving for the first time, and
     * it is still in the accessibility tree at all times — see `InfoHint` for
     * why it is not mounted on open.
     */
    readingsBody:
      'The latest figures for the window above, each against the limit it is held to. The charts say how the line moved; these say where it has arrived.',
    /** Names the icon that opens the explanations. `{section}` is the heading. */
    sectionHint: 'About: {section}',
    scrapTitle: 'Where the scrap happened',
    scrapBody:
      'Ordered by process step. A cell lost at formation has absorbed every upstream cost, so late-stage losses are the expensive ones.',
    scrapTableCaption: 'Scrap rate by process step',
    /*
     * The figure's own heading, distinct from `scrapTitle` above it.
     *
     * `DashboardView` renders `scrapTitle` as the section's h2 and the chart
     * sits directly beneath it. Reusing that string as the figure's h3 would
     * announce the same words twice in a row to a screen reader and read as a
     * duplication to everyone else.
     */
    scrapChartTitle: 'Scrap rate by step',
    scrapChartDescription:
      'Each bar is one step of the line, in process order. The figure beside it is the share of cells lost there.',
    columnStep: 'Process step',
    columnScrap: 'Scrap rate',
    columnCost: 'Committed value lost',
    /*
     * The data table's own copy. `viewChart` / `viewTable` name the two views
     * of every chart; the rest is the table's toolbar.
     *
     * Every string is required by the component that shows it — none has a
     * default, because a component cannot know the page's language and a
     * default is therefore a guess that ships. `SpecBand` established this
     * after the German landing page announced the product's signature element
     * entirely in English, invisible to axe and to every screenshot.
     */
    table: {
      viewChart: 'Chart',
      viewTable: 'Table',
      search: 'Search',
      searchPlaceholder: 'Batch or process step',
      rangeMin: 'Minimum',
      rangeMax: 'Maximum',
      dateFrom: 'Earliest',
      dateTo: 'Latest',
      reset: 'Clear filters',
      exportCsv: 'Download CSV',
      summary: 'Showing {shown} of {total} rows',
      empty: 'No rows match these filters.',
      sortedAscending: 'Sorted by {column}, lowest first',
      sortedDescending: 'Sorted by {column}, highest first',
      sortCleared: 'Sorting cleared, back to {column} order',
    },
    bandsTitle: 'Process parameters against specification',
    bandsBody:
      'Each parameter against the window the process is held to, and beneath it the same parameter over time. A band says "out of spec"; the chart under it says "and it has been drifting for six weeks", which is the difference between a symptom and a diagnosis.',

    /*
     * The exceptions panel at the top of the page.
     *
     * `label` strings are the non-colour signal. Every row is tinted by
     * severity *and* carries the word, because a reader who cannot separate the
     * two hues — or is looking at a printout — must still get the verdict.
     */
    attention: {
      title: 'Needs attention',
      hint: 'Everything on this page that is currently outside its window, gathered in one place. Readings in spec do not appear here; the most expensive process step always does, because the money does not stop being the money on a good day.',
      outOfSpec: 'Out of spec',
      belowPeers: 'Below peers',
      largestLoss: 'Largest loss',
      inSpec: 'In spec',
      yieldBody: 'First-pass yield is at {value}. The window is {lower} to {upper}.',
      parameterBody: '{parameter} is at {value}. The window is {lower} to {upper}.',
      cohortBody: 'First-pass yield is {gap} below the median of comparable lines.',
      costBody: '{step} accounts for {value} of committed value lost this window.',
      clearBody: 'Every reading is inside the window it is held to.',
    },

    kpi: {
      costLabel: 'Committed value lost',
      costNote: 'What the scrapped cells had already cost by the time they were lost.',
      cellsLabel: 'Cells to end-of-line',
      cellsNote: 'Passed without rework, of {started} started.',
      benchmarkLabel: 'Against comparable lines',
      benchmarkNote: 'Median of {n} pilot lines is {median}.',
      worstLabel: 'Worst batch',
      worstNote: 'Lowest first-pass yield of {count} batches in this window.',
    },

    /*
     * Chart copy. Every string here is required by the component that shows it
     * — none has an English default, because `packages/ui` learned the hard way
     * that a default is a guess and it ships. A chart's drawing is aria-hidden,
     * so its caption is its entire announced identity above the table, and axe
     * is indifferent to which language a well-formed string is in.
     */
    charts: {
      trendTitle: 'How it got here',
      trendBody:
        'The headline says where the line is now. These say how it moved, which is the difference between a reading to note and a process to go and look at.',

      yieldTrend: {
        title: 'First-pass yield, batch by batch',
        description:
          'Each point is one production run. The dashed lines are what {n} comparable lines achieve, and this line’s specification limits where they fall on the scale.',
        lowerLimit: 'Lower limit',
        upperLimit: 'Upper limit',
        seriesMeasured: 'This line',
        cohortMedian: 'Cohort median',
        cohortTop: 'Cohort top 10%',
        tooltipCells: '{passed} of {started} cells',
        tableCaption: 'First-pass yield by batch, with the cells behind each figure',
        columnBatch: 'Batch',
        columnDate: 'Started',
        columnYield: 'First-pass yield',
        columnCells: 'Cells',
      },

      /*
       * The distribution. Its axis labels are bare bin edges, so the unit has
       * to be carried by the caption and by every tooltip and table cell — one
       * of the few places in this app where a number's unit is not adjacent to
       * it on screen, and the reason `range` is a template rather than a
       * concatenation.
       */
      yieldDistribution: {
        title: 'How often the line hits each level',
        description:
          'The same batches with time thrown away. A tight cluster below target is a setting that is wrong; the same average spread across twenty points is a process that is not in control, and those need different fixes.',
        seriesName: 'Batches',
        range: '{from} to {to}',
        batches: '{count} batches',
        lowerLimit: 'Lower limit',
        upperLimit: 'Upper limit',
        cohortMedian: 'Cohort median',
        tableCaption: 'Number of batches at each level of first-pass yield',
        columnRange: 'First-pass yield',
        columnBatches: 'Batches',
        columnShare: 'Share of window',
      },

      costTrend: {
        title: 'What the window has cost, as it accumulated',
        description:
          'The running total of committed value lost. A cumulative line can only rise — its slope is the news, and a curve that steepens is a process getting worse in a way a monthly total cannot show.',
        seriesName: 'Cumulative value lost',
        batchLoss: 'This batch',
        tableCaption: 'Committed value lost per batch and cumulatively',
        columnBatch: 'Batch',
        columnDate: 'Started',
        columnLost: 'Lost in this batch',
        columnCumulative: 'Running total',
      },

      throughput: {
        title: 'What each run produced',
        description:
          'The same batches by cell count rather than by rate. A 42 per cent yield on a 180-cell trial and on a 1 400-cell run are the same point on the chart above and very different events.',
        seriesPassed: 'Passed end-of-line',
        seriesScrapped: 'Scrapped',
        axisLabel: 'Cells',
        tableCaption: 'Cells started, passed and scrapped, by batch',
        columnBatch: 'Batch',
        columnStarted: 'Cells started',
      },

      scrapCost: {
        title: 'What the scrap was worth',
        description:
          'The same losses as above, priced. Coating scraps the most cells; formation loses the most money, because a cell scrapped there has already absorbed every upstream cost.',
        seriesName: 'Committed value lost',
        tableCaption: 'Committed value lost at each process step',
        columnStep: 'Process step',
        columnScrap: 'Scrap rate',
      },

      control: {
        descriptionInSpec: 'Every reading inside {lower} to {upper} {unit}.',
        descriptionBreached: '{count} of {total} readings outside the specification window.',
        lowerLimit: 'Lower limit',
        upperLimit: 'Upper limit',
        target: 'Target',
        inSpec: 'In spec',
        outOfSpec: 'Out of spec',
        tableCaption: '{parameter} by batch, against its specification window',
        columnDate: 'Measured',
        columnValue: 'Value ({unit})',
        columnVerdict: 'Against spec',
      },
    },
    parameters: {
      porosity_pct: 'Electrode porosity after calendering',
      areal_loading_mg_cm2: 'Areal loading',
      energy_density_wh_kg: 'Energy density',
      coating_thickness_um: 'Coating thickness',
    },
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

  /*
   * Email confirmation.
   *
   * Two surfaces: the banner an unconfirmed account carries, and the page the
   * link in the message lands on. Both have a German twin below — a confirmation
   * email written in German that lands on an English page has confirmed the
   * address and lost the reader.
   */
  verifyEmail: {
    pageTitle: 'Confirm your email address',
    checking: 'Confirming your address…',

    successTitle: 'Address confirmed',
    successBody: 'That is done — thank you. Nothing else is needed here.',
    toDashboard: 'Go to your dashboard',

    expiredTitle: 'This link has expired',
    expiredBody:
      'Confirmation links last 24 hours. Log in and ask for a new one from your profile.',

    invalidTitle: 'This link is not valid',
    invalidBody:
      'It may already have been used, or copied without its last few characters. Log in and ask for a new one.',

    missingTitle: 'This page needs a link',
    missingBody: 'Open the link in the confirmation email rather than this page on its own.',

    errorTitle: 'Something went wrong',
    errorBody: 'We could not confirm your address just now. Try the link again in a moment.',

    toLogin: 'Log in',
  },

  /* The banner an unconfirmed account carries. Deliberately not a blocker. */
  unverified: {
    title: 'Confirm your email address',
    /*
     * Says what confirming is *for*. "Please confirm your email" with no reason
     * is the sentence every reader has learned to dismiss — and since nothing
     * here is gated on it, a threat would also be a lie.
     */
    body: 'We sent a link to {email}. Confirming it is how we can reach you about your account, and how you get back in if you lose your password.',
    resend: 'Send the link again',
    resending: 'Sending…',
    sent: 'On its way. It can take a minute to arrive — check your spam folder too.',
    alreadyVerified: 'That address is already confirmed.',
    rateLimited: 'That is a few too many. Try again in an hour.',
    failed: 'We could not send it just now. Please try again shortly.',
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
