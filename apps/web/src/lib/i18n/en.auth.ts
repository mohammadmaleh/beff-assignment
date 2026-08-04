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
    readingsBody:
      'The latest figures for the window above, each against the limit it is held to. The charts say how the line moved; these say where it has arrived.',
    scrapTitle: 'Where the scrap happened',
    scrapBody:
      'Ordered by process step. A cell lost at formation has absorbed every upstream cost, so late-stage losses are the expensive ones.',
    scrapTableCaption: 'Scrap rate by process step',
    columnStep: 'Process step',
    columnScrap: 'Scrap rate',
    columnCost: 'Committed value lost',
    showTable: 'Show the data as a table',
    hideTable: 'Hide the table',
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
      rangeMin: 'From',
      rangeMax: 'To',
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
