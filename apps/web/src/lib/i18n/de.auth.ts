import type { enApp } from './en.auth';

/** German for the app surfaces. Typed against `enApp`, so a gap is a build error. */
export const deApp: typeof enApp = {
  auth: {
    loginTitle: 'Anmelden',
    loginSubtitle: 'Weiter, wo die Linie aufgehört hat.',
    registerTitle: 'Konto anlegen',
    registerSubtitle: 'Ein Konto pro Person. Werke und Linien folgen im nächsten Schritt.',
    emailLabel: 'Geschäftliche E-Mail-Adresse',
    passwordLabel: 'Passwort',
    passwordHint: 'Mindestens 12 Zeichen. Länge schlägt Sonderzeichen.',
    nameLabel: 'Name',
    submitLogin: 'Anmelden',
    submitRegister: 'Konto anlegen',
    submittingLogin: 'Sie werden angemeldet …',
    submittingRegister: 'Ihr Konto wird angelegt …',
    noAccount: 'Noch kein Konto?',
    haveAccount: 'Sie haben bereits ein Konto?',
    toRegister: 'Jetzt anlegen',
    toLogin: 'Anmelden',
    failedTitle: 'Das hat nicht geklappt',
  },

  apiErrors: {
    unknownFailure: 'Auf unserer Seite ist etwas schiefgegangen. Bitte versuchen Sie es erneut.',

    byCode: {
      'auth.invalid_credentials': 'E-Mail-Adresse und Passwort passen zu keinem Konto.',
      'auth.email_already_registered':
        'Für diese E-Mail-Adresse besteht bereits ein Konto. Melden Sie sich an oder verwenden Sie eine andere Adresse.',
      'auth.email_already_verified': 'Diese Adresse wurde bereits bestätigt.',
      'auth.refresh_token_expired': 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
      'auth.refresh_token_reused':
        'Sie wurden zu Ihrer Sicherheit abgemeldet, weil eine abgelaufene Sitzung erneut verwendet wurde. Bitte melden Sie sich erneut an.',
      'auth.verification_token_expired':
        'Dieser Bestätigungslink ist abgelaufen. Fordern Sie einen neuen an.',
      'auth.verification_token_invalid':
        'Dieser Bestätigungslink ist ungültig oder wurde bereits verwendet.',
      rate_limit_exceeded:
        'Zu viele Versuche. Bitte warten Sie einen Moment, bevor Sie es erneut versuchen.',
      validation_error: 'Bitte prüfen Sie Ihre Eingaben.',
    },
  },

  onboarding: {
    title: 'Linie einrichten',
    resumeNotice: 'Weiter an der Stelle, an der Sie aufgehört haben.',
    stepOf: 'Schritt {current} von {total}',
    next: 'Weiter',
    back: 'Zurück',
    finish: 'Einrichtung abschließen',
    finishing: 'Ihre Einrichtung wird gespeichert …',
    steps: {
      role: {
        title: 'Was ist Ihre Rolle?',
        body: 'Danach richtet sich, womit die Übersicht beginnt.',
        label: 'Ihre Rolle',
        options: {
          process_engineer: 'Prozessingenieur/in',
          quality_engineer: 'Qualitätsingenieur/in',
          production_manager: 'Produktionsleitung',
          other: 'Etwas anderes',
        },
      },
      plant: {
        title: 'Wo steht die Linie?',
        body: 'Zunächst ein Werk. Weitere lassen sich später ergänzen.',
        nameLabel: 'Name des Werks',
        countryLabel: 'Land',
        country: {
          placeholder: 'Land suchen',
          noResults: 'Kein passendes Land gefunden',
          toggleLabel: 'Länderliste anzeigen',
          resultsAnnouncement: '{count} Länder verfügbar',
          selectionAnnouncement: '{country} ausgewählt',
        },
      },
      lines: {
        title: 'Welche Linie?',
        body: 'Bei einer Pilotlinie ist eine niedrigere Ausbeute normal - die Übersicht bewertet sie entsprechend.',
        nameLabel: 'Name der Linie',
        kindLabel: 'Linientyp',
        kindPilot: 'Pilotlinie',
        kindProduction: 'Produktionslinie',
        formatLabel: 'Zellformat',
        formatPouch: 'Pouch',
        formatPrismatic: 'Prismatisch',
        formatCylindrical: 'Rundzelle',
      },
      units: {
        title: 'Welche Einheiten?',
        body: 'Gilt für jede Kennzahl in der Übersicht. Später änderbar.',
        label: 'Einheitensystem',
        metric: 'Metrisch (mm, kg, °C)',
        imperial: 'Imperial (in, lb, °F)',
      },
      review: {
        title: 'Bitte prüfen',
        body: 'Nichts davon ist endgültig - Sie können alles später im Profil ändern.',
        label: 'Ihre Einrichtung',
      },
    },
  },

  dashboard: {
    title: 'Produktionsübersicht',
    subtitle: 'Letzte 30 Tage',
    loading: 'Produktionskennzahlen werden geladen',
    errorTitle: 'Produktionskennzahlen konnten nicht geladen werden',
    emptyTitle: 'Noch keine Chargen erfasst',
    emptyBody: 'Sobald die Linie die erste Charge meldet, füllt sich diese Ansicht.',
    deltaNote: 'gegenüber dem vorherigen Zeitraum',
    metrics: {
      fpy: 'Erstdurchlaufquote',
      scrap: 'Ausschussquote',
      retention: 'Kapazitätserhalt nach 1000 Zyklen',
      co2: 'CO₂-Intensität',
    },
    readingsTitle: 'Wo die Linie heute steht',
    readingsBody:
      'Die aktuellen Werte für den Zeitraum oben, jeder gegen die Grenze, an der er gemessen wird. Die Diagramme zeigen die Bewegung; diese Werte zeigen, wo sie geendet hat.',
    /** Benennt das Symbol, das die Erläuterung öffnet. `{section}` ist die Überschrift. */
    sectionHint: 'Erläuterung: {section}',
    scrapTitle: 'Wo der Ausschuss entstanden ist',
    scrapBody:
      'Nach Prozessschritt geordnet. Eine in der Formierung verlorene Zelle hat alle vorgelagerten Kosten aufgenommen - späte Verluste sind die teuren.',
    scrapTableCaption: 'Ausschussquote je Prozessschritt',
    /*
     * Die eigene Überschrift der Abbildung, getrennt von `scrapTitle` darüber.
     *
     * `DashboardView` rendert `scrapTitle` als h2 des Abschnitts, und das
     * Diagramm steht direkt darunter. Dieselbe Zeichenkette als h3 zu
     * wiederholen würde einem Screenreader zweimal dasselbe ansagen.
     */
    scrapChartTitle: 'Ausschussquote je Schritt',
    scrapChartDescription:
      'Jeder Balken ist ein Schritt der Linie, in Prozessreihenfolge. Die Zahl daneben ist der Anteil der dort verlorenen Zellen.',
    columnStep: 'Prozessschritt',
    columnScrap: 'Ausschussquote',
    columnCost: 'Verlorene gebundene Wertschöpfung',
    /*
     * Texte der Datentabelle. `viewChart` / `viewTable` benennen die beiden
     * Ansichten jedes Diagramms; der Rest gehört zur Werkzeugleiste der Tabelle.
     *
     * Jede Zeichenkette ist Pflicht für die Komponente, die sie anzeigt - keine
     * hat einen Standardwert, denn eine Komponente kann die Seitensprache nicht
     * kennen, und ein Standard wäre darum eine Vermutung, die ausgeliefert wird.
     * `SpecBand` hat das gelernt: Die deutsche Zielseite kündigte das Markenzeichen
     * des Produkts ganz auf Englisch an, unsichtbar für axe und für jeden Screenshot.
     */
    table: {
      viewChart: 'Diagramm',
      viewTable: 'Tabelle',
      search: 'Suchen',
      searchPlaceholder: 'Charge oder Prozessschritt',
      rangeMin: 'Mindestens',
      rangeMax: 'Höchstens',
      dateFrom: 'Frühestens',
      dateTo: 'Spätestens',
      reset: 'Filter zurücksetzen',
      exportCsv: 'CSV herunterladen',
      summary: '{shown} von {total} Zeilen',
      empty: 'Keine Zeilen entsprechen diesen Filtern.',
      sortedAscending: 'Sortiert nach {column}, aufsteigend',
      sortedDescending: 'Sortiert nach {column}, absteigend',
      sortCleared: 'Sortierung aufgehoben, zurück zur Reihenfolge nach {column}',
    },
    bandsTitle: 'Prozessparameter gegen Spezifikation',
    bandsBody:
      'Jeder Parameter gegen das Fenster, an dem der Prozess gemessen wird, und darunter derselbe Parameter im Zeitverlauf. Das Band sagt „außerhalb der Spezifikation“; das Diagramm darunter sagt „und driftet seit sechs Wochen“ - der Unterschied zwischen einem Symptom und einer Diagnose.',

    /*
     * Der Abschnitt mit den Ausnahmen am Kopf der Seite.
     *
     * Die `label`-Zeichenketten sind das Signal jenseits der Farbe. Jede Zeile
     * ist nach Schweregrad eingefärbt *und* trägt das Wort - wer die beiden
     * Farbtöne nicht unterscheiden kann oder auf einen Ausdruck schaut, braucht
     * das Urteil trotzdem.
     */
    attention: {
      title: 'Erfordert Aufmerksamkeit',
      hint: 'Alles auf dieser Seite, was derzeit außerhalb seines Fensters liegt, an einer Stelle gesammelt. Werte innerhalb der Spezifikation erscheinen hier nicht; der teuerste Prozessschritt immer - denn das Geld bleibt auch an einem guten Tag das Geld.',
      outOfSpec: 'Außerhalb der Spezifikation',
      belowPeers: 'Unter der Vergleichsgruppe',
      largestLoss: 'Größter Verlust',
      inSpec: 'In Spezifikation',
      yieldBody:
        'Die Erstdurchlaufquote liegt bei {value}. Das Fenster reicht von {lower} bis {upper}.',
      parameterBody: '{parameter} liegt bei {value}. Das Fenster reicht von {lower} bis {upper}.',
      cohortBody: 'Die Erstdurchlaufquote liegt {gap} unter dem Median vergleichbarer Linien.',
      costBody:
        'Auf {step} entfallen {value} der in diesem Zeitraum verlorenen gebundenen Wertschöpfung.',
      clearBody: 'Jeder Wert liegt innerhalb des Fensters, an dem er gemessen wird.',
    },

    kpi: {
      costLabel: 'Verlorene gebundene Wertschöpfung',
      costNote: 'Was die verworfenen Zellen bis zum Verlust bereits gekostet hatten.',
      cellsLabel: 'Zellen bis zur Endprüfung',
      cellsNote: 'Ohne Nacharbeit bestanden, von {started} gestarteten.',
      benchmarkLabel: 'Gegenüber vergleichbaren Linien',
      benchmarkNote: 'Der Median von {n} Pilotlinien liegt bei {median}.',
      worstLabel: 'Schwächste Charge',
      worstNote: 'Niedrigste Erstdurchlaufquote von {count} Chargen in diesem Zeitraum.',
    },

    /*
     * Diagrammtexte. Jede Zeichenkette ist Pflicht - keine hat einen englischen
     * Standardwert. Die Zeichnung selbst ist `aria-hidden`, also ist die
     * Beschriftung die gesamte angekündigte Identität des Diagramms, und axe
     * ist es gleichgültig, in welcher Sprache eine wohlgeformte Zeichenkette
     * steht.
     */
    charts: {
      trendTitle: 'Wie es dazu kam',
      trendBody:
        'Die Kennzahl oben sagt, wo die Linie heute steht. Diese Diagramme zeigen die Bewegung dorthin - der Unterschied zwischen einem Messwert und einem Prozess, den man sich ansehen muss.',

      yieldTrend: {
        title: 'Erstdurchlaufquote je Charge',
        description:
          'Jeder Punkt ist ein Produktionslauf. Die gestrichelten Linien zeigen, was {n} vergleichbare Linien erreichen - und die Spezifikationsgrenzen dieser Linie, soweit sie in den Maßstab fallen.',
        lowerLimit: 'Untergrenze',
        upperLimit: 'Obergrenze',
        seriesMeasured: 'Diese Linie',
        cohortMedian: 'Median der Vergleichsgruppe',
        cohortTop: 'Beste 10 % der Vergleichsgruppe',
        tooltipCells: '{passed} von {started} Zellen',
        tableCaption: 'Erstdurchlaufquote je Charge, mit den zugrunde liegenden Zellzahlen',
        columnBatch: 'Charge',
        columnDate: 'Gestartet',
        columnYield: 'Erstdurchlaufquote',
        columnCells: 'Zellen',
      },

      /*
       * Die Verteilung. Ihre Achsenbeschriftungen sind blanke Klassengrenzen,
       * die Einheit tragen also Beschriftung, Tooltip und Tabelle - eine der
       * wenigen Stellen in dieser Anwendung, an der eine Zahl ihre Einheit
       * nicht direkt daneben stehen hat.
       */
      yieldDistribution: {
        title: 'Wie oft die Linie welches Niveau erreicht',
        description:
          'Dieselben Chargen, ohne die Zeitachse. Eine enge Häufung unter dem Zielwert ist eine falsche Einstellung; dieselbe Lage über zwanzig Punkte verteilt ist ein Prozess außer Kontrolle - und beides verlangt einen anderen Eingriff.',
        seriesName: 'Chargen',
        range: '{from} bis {to}',
        batches: '{count} Chargen',
        lowerLimit: 'Untergrenze',
        upperLimit: 'Obergrenze',
        cohortMedian: 'Median der Vergleichsgruppe',
        tableCaption: 'Anzahl der Chargen je Niveau der Erstdurchlaufquote',
        columnRange: 'Erstdurchlaufquote',
        columnBatches: 'Chargen',
        columnShare: 'Anteil am Zeitraum',
      },

      costTrend: {
        title: 'Was der Zeitraum gekostet hat, im Verlauf',
        description:
          'Die laufende Summe der verlorenen gebundenen Wertschöpfung. Eine kumulierte Linie kann nur steigen - ihre Steigung ist die Nachricht, und eine steiler werdende Kurve zeigt eine Verschlechterung, die eine Monatssumme nicht sichtbar macht.',
        seriesName: 'Kumulierter Verlust',
        batchLoss: 'Diese Charge',
        tableCaption: 'Verlorene gebundene Wertschöpfung je Charge und kumuliert',
        columnBatch: 'Charge',
        columnDate: 'Gestartet',
        columnLost: 'Verlust dieser Charge',
        columnCumulative: 'Laufende Summe',
      },

      throughput: {
        title: 'Was jeder Lauf produziert hat',
        description:
          'Dieselben Chargen nach Zellzahl statt nach Quote. 42 Prozent Ausbeute bei einem Versuch mit 180 Zellen und bei einem Lauf mit 1 400 Zellen sind derselbe Punkt im Diagramm darüber und sehr unterschiedliche Ereignisse.',
        seriesPassed: 'Endprüfung bestanden',
        seriesScrapped: 'Ausgeschleust',
        axisLabel: 'Zellen',
        tableCaption: 'Gestartete, bestandene und ausgeschleuste Zellen je Charge',
        columnBatch: 'Charge',
        columnStarted: 'Gestartete Zellen',
      },

      scrapCost: {
        title: 'Was der Ausschuss wert war',
        description:
          'Dieselben Verluste, bewertet. Beim Beschichten gehen die meisten Zellen verloren; in der Formierung das meiste Geld, denn eine dort verworfene Zelle hat bereits alle vorgelagerten Kosten aufgenommen.',
        seriesName: 'Verlorene gebundene Wertschöpfung',
        tableCaption: 'Verlorene gebundene Wertschöpfung je Prozessschritt',
        columnStep: 'Prozessschritt',
        columnScrap: 'Ausschussquote',
      },

      control: {
        descriptionInSpec: 'Alle Messwerte zwischen {lower} und {upper} {unit}.',
        descriptionBreached: '{count} von {total} Messwerten außerhalb des Spezifikationsfensters.',
        lowerLimit: 'Untergrenze',
        upperLimit: 'Obergrenze',
        target: 'Zielwert',
        inSpec: 'In Spezifikation',
        outOfSpec: 'Außerhalb der Spezifikation',
        tableCaption: '{parameter} je Charge, gegen das Spezifikationsfenster',
        columnDate: 'Gemessen',
        columnValue: 'Messwert ({unit})',
        columnVerdict: 'Gegen Spezifikation',
      },
    },
    parameters: {
      porosity_pct: 'Elektrodenporosität nach dem Kalandrieren',
      areal_loading_mg_cm2: 'Flächenbeladung',
      energy_density_wh_kg: 'Energiedichte',
      coating_thickness_um: 'Schichtdicke',
    },
    steps: {
      mixing: 'Mischen',
      coating: 'Beschichten',
      drying: 'Trocknen',
      calendering: 'Kalandrieren',
      slitting: 'Längsschneiden',
      die_cutting: 'Stanzen',
      stacking: 'Stapeln / Wickeln',
      welding: 'Ableiterschweißen',
      filling: 'Elektrolytbefüllung',
      formation: 'Formierung',
      aging: 'Reifung',
      eol_test: 'Endprüfung',
    },
  },

  verifyEmail: {
    pageTitle: 'E-Mail-Adresse bestätigen',
    checking: 'Ihre Adresse wird bestätigt …',

    successTitle: 'Adresse bestätigt',
    successBody: 'Das war es - vielen Dank. Hier ist nichts weiter zu tun.',
    toDashboard: 'Zum Dashboard',

    expiredTitle: 'Dieser Link ist abgelaufen',
    expiredBody:
      'Bestätigungslinks sind 24 Stunden gültig. Melden Sie sich an und fordern Sie in Ihrem Profil einen neuen an.',

    invalidTitle: 'Dieser Link ist ungültig',
    invalidBody:
      'Möglicherweise wurde er bereits verwendet oder unvollständig kopiert. Melden Sie sich an und fordern Sie einen neuen an.',

    missingTitle: 'Dieser Seite fehlt ein Link',
    missingBody: 'Bitte öffnen Sie den Link aus der Bestätigungs-E-Mail statt dieser Seite allein.',

    errorTitle: 'Etwas ist schiefgelaufen',
    errorBody:
      'Ihre Adresse konnte gerade nicht bestätigt werden. Versuchen Sie den Link in einem Moment erneut.',

    toLogin: 'Anmelden',
  },

  unverified: {
    title: 'E-Mail-Adresse bestätigen',
    body: 'Wir haben einen Link an {email} gesendet. Mit der Bestätigung können wir Sie zu Ihrem Konto erreichen - und Sie kommen wieder hinein, falls Sie Ihr Passwort verlieren.',
    resend: 'Link erneut senden',
    resending: 'Wird gesendet …',
    sent: 'Unterwegs. Die Zustellung kann eine Minute dauern - sehen Sie auch im Spam-Ordner nach.',
    alreadyVerified: 'Diese Adresse ist bereits bestätigt.',
    rateLimited: 'Das waren etwas zu viele Versuche. Bitte in einer Stunde erneut versuchen.',
    failed: 'Der Versand hat gerade nicht geklappt. Bitte versuchen Sie es gleich noch einmal.',
  },

  profile: {
    title: 'Ihr Konto',
    detailsTitle: 'Angaben',
    consentTitle: 'Einwilligungen',
    consentBody:
      'Der Widerruf ist so einfach wie die Erteilung. Einwilligungsnachweise werden nur ergänzt, nie überschrieben - die Historie ist der Nachweis, wozu Sie wann eingewilligt haben, und dieser Nachweis ist selbst eine Rechtspflicht.',
    consentAnalytics: 'Analyse-Cookies',
    consentMarketing: 'Produkt-E-Mails',
    consentSaving: 'Ihre Auswahl wird gespeichert …',
    consentSaved: 'Gespeichert',
    exportTitle: 'Ihre Daten mitnehmen',
    exportBody:
      'Eine maschinenlesbare Kopie von allem, was zu Ihrem Konto gehört (Art. 15 und Art. 20). Passwort-Hashes und Daten Dritter sind nie enthalten. Wir erstellen den Export im Hintergrund; er erscheint hier, sobald er fertig ist.',
    exportRequest: 'Export anfordern',
    exportRequesting: 'Export wird angefordert …',
    exportPending:
      'Der Export wird vorbereitet. Diese Seite aktualisiert sich, sobald er fertig ist.',
    exportReady: 'Ihr Export ist fertig.',
    exportDownload: 'Herunterladen',
    exportFailed:
      'Dieser Export konnte nicht erstellt werden. Eine erneute Anforderung ist unbedenklich.',
    dangerTitle: 'Konto löschen',
    dangerBody:
      'Damit werden Ihr Konto und alles daran Hängende gelöscht (Art. 17). Das lässt sich nicht rückgängig machen, und die E-Mail-Adresse wird wieder frei.',
    dangerConfirmLabel: 'Zur Bestätigung LÖSCHEN eingeben',
    dangerConfirmWord: 'LÖSCHEN',
    dangerSubmit: 'Mein Konto endgültig löschen',
    dangerSubmitting: 'Ihr Konto wird gelöscht …',
    dangerMismatch: 'Bitte geben Sie LÖSCHEN genau so ein.',
  },
};
