import type { BaseDictionary } from './en';

/**
 * German. Typed against the English dictionary, so a missing key is a compile
 * error rather than an English word appearing mid-sentence in production.
 *
 * The domain terms are the German ones an engineer at a cell manufacturer
 * actually uses — Ausschuss, Kalandrieren, Formierung — not translations of the
 * English. Getting these wrong is more damaging than shipping English only.
 */
export const de: BaseDictionary = {
  meta: {
    title: 'Beff — Produktionsintelligenz für die Batteriezellfertigung',
    description:
      'Sehen Sie, wo die Erstdurchlaufquote verloren geht, was der Ausschuss kostet und was das für die CO₂-Bilanz pro kWh bedeutet. Für Pilot- und Produktionslinien.',
    localeName: 'Deutsch',
    switchTo: 'View in English',
  },

  nav: {
    skipToContent: 'Zum Hauptinhalt springen',
    dashboard: 'Übersicht',
    profile: 'Profil',
    logIn: 'Anmelden',
    logOut: 'Abmelden',
    getStarted: 'Zugang anfragen',
    primary: 'Hauptnavigation',
    product: 'Produkt',
    technology: 'Technologie',
    themeToLight: 'Zu heller Darstellung wechseln',
    themeToDark: 'Zu dunkler Darstellung wechseln',
  },

  landing: {
    eyebrow: 'Vor dem Marktstart',
    headline: 'Ausschuss erkennen, bevor er die Formierung erreicht.',
    subhead:
      'Eine Zelle, die in der Formierung ausgeschleust wird, hat bereits alle vorgelagerten Kosten aufgenommen. Beff zeigt, wo die Erstdurchlaufquote verloren geht, an welchem Prozessschritt und was das wert ist — aus den Daten, die Ihre Linie ohnehin erzeugt.',
    ctaPrimary: 'Zugang anfragen',
    ctaSecondary: 'Was gemessen wird',

    heroReadingLabel: 'Erstdurchlaufquote · Linie 3 · KW 30',
    heroReadingNote:
      'Eine Produktionslinie ist auf 85 bis 97 Prozent spezifiziert. Diese verliert mehr als jede fünfte Zelle vor der Endprüfung — und die Zahl allein sagt nicht, wo.',

    problemTitle: 'Die Daten sind längst da. Verteilt auf vierzehn Tabellen.',
    problemBody:
      'Schichtdicken in einem Export, Formierungsergebnisse in einem anderen, Ausschuss schichtweise auf Papier. Bis das Bild zusammengesetzt ist, ist die Charge ausgeliefert und die Antwort drei Wochen alt.',

    costTitle: 'Wo die Wertschöpfung schon gebunden ist',
    costBody:
      'Die Kosten laufen entlang der Kette auf: Material, Energie und Linienzeit gehen an jedem Schritt hinein und kommen nicht wieder heraus. Eine Zelle, die in der Formierung ausgeschleust wird, trägt 90 Prozent ihrer Endkosten. Dieselbe Zelle beim Coating trägt 21 Prozent. In Prozent gemeldet sehen die beiden Verluste gleich aus.',
    costFigureLabel: 'Gebundene Wertschöpfung je Zelle nach Prozessschritt',
    costFigureDescription:
      'Die gebundene Wertschöpfung steigt Schritt für Schritt von 7 Prozent der Endkosten beim Mischen auf 100 Prozent bei der Endprüfung, mit den größten Einzelsprüngen beim Coating, beim Elektrolytbefüllen und in der Formierung.',
    costAxisStart: 'Zelle angesetzt',
    costAxisEnd: 'Zelle fertig',
    costColumnStep: 'Prozessschritt',
    costColumnCommitted: 'Gebundene Wertschöpfung',
    costTableCaption:
      'Gebundene Wertschöpfung je Zelle an jedem Prozessschritt, als Anteil der Endkosten',

    productTitle: 'Der Blick um 08:40',
    productBody:
      'Die Ausbeute ist über Nacht gefallen, um neun ist Besprechung. Das ist der Bildschirm — mit den Komponenten, die die Anwendung ausliefert, auf den Zahlen, die eine Pilotlinie tatsächlich erzeugt.',
    productLineLabel: 'Pilotlinie 1 · letzte 30 Tage',
    productNote:
      'Jeder Messwert steht vor seinem Spezifikationsfenster, und hinter jedem Diagramm liegt eine Tabelle.',

    signatureTitle: 'Aufgebaut auf dem Toleranzband',
    signatureBody:
      'Jeder Messwert steht in Beff vor seinem Spezifikationsfenster — so, wie ihn eine Regelkarte oder ein Kalibrierschein ohnehin zeigt. In der Spezifikation, außerhalb, und um wie viel. Auf einen Blick lesbar, und auch ohne Farbe lesbar.',
    signatureExampleLabel: 'Elektrodenporosität nach dem Kalandrieren',

    filmEyebrow: 'Das Unternehmen',
    filmTitle: 'Beff in gut einer Minute',
    filmBody:
      'Beffs eigene Einführung in die Arbeit dahinter: der Expertenchat, der Navigator für die Spezifikation und die Virtual Factory Platform, die das Team bereits mit Zellherstellern betreibt.',
    filmLabel: 'Beff Unternehmensfilm',

    waitlistTitle: 'Zugang anfragen',
    waitlistBody:
      'Wir binden zuerst Pilotlinien an. Sagen Sie uns, wo Sie stehen — wir melden uns.',
    waitlistEmailLabel: 'Geschäftliche E-Mail-Adresse',
    waitlistEmailDescription:
      'Wir nutzen sie, um Sie wegen des Zugangs zu kontaktieren. Für nichts anderes.',
    waitlistCompanyLabel: 'Unternehmen',
    waitlistSubmit: 'Zugang anfragen',
    waitlistSubmitting: 'Anfrage wird gesendet …',
    waitlistSuccessTitle: 'Anfrage eingegangen',
    waitlistSuccessBody: 'Wir melden uns unter der angegebenen Adresse.',
    waitlistErrorTitle: 'Das konnte nicht gesendet werden',
    waitlistErrorBody:
      'Auf unserer Seite ist etwas schiefgegangen. Bitte versuchen Sie es gleich noch einmal.',
  },

  footer: {
    tagline: 'Produktionsintelligenz für die Batteriezellfertigung.',
    legal: 'Rechtliches',
    impressum: 'Impressum',
    privacy: 'Datenschutzerklärung',
    terms: 'Nutzungsbedingungen',
    accessibility: 'Barrierefreiheit',
    company: 'Unternehmen',
    about: 'Über uns',
    language: 'Sprache',
    rights: 'Alle Rechte vorbehalten.',
  },

  cookies: {
    title: 'Cookies',
    body: 'Wir setzen Cookies ein, die für den Betrieb dieser Website unbedingt erforderlich sind. Darüber hinaus möchten wir Analyse-Cookies setzen, um zu verstehen, welche Seiten nützlich sind — nur mit Ihrer Einwilligung, und Sie können sie jederzeit widerrufen.',
    necessaryLabel: 'Unbedingt erforderlich',
    necessaryNote:
      'Nötig für die Anmeldung und um Sie angemeldet zu halten. Diese lassen sich nicht abschalten.',
    analyticsLabel: 'Analyse',
    analyticsNote: 'Anonyme Seitenaufrufe. Standardmäßig aus, bis Sie sie einschalten.',
    accept: 'Analyse zulassen',
    reject: 'Analyse ablehnen',
    save: 'Auswahl speichern',
    moreInfo: 'Datenschutzerklärung lesen',
  },

  legal: {
    impressumTitle: 'Impressum',
    impressumNote:
      'Angaben gemäß §5 DDG. Dies ist ein Demonstrationsprojekt; die folgenden Angaben sind Platzhalter.',
    privacyTitle: 'Datenschutzerklärung',
    privacyNote:
      'Angaben gemäß Art. 13 DSGVO. Dies ist ein Demonstrationsprojekt; die folgenden Angaben sind Platzhalter.',
    termsTitle: 'Nutzungsbedingungen',
    termsNote:
      'Für Unternehmer, nach deutschem Recht. Dies ist ein Demonstrationsprojekt; diese Bedingungen wurden nicht anwaltlich geprüft.',
    accessibilityTitle: 'Erklärung zur Barrierefreiheit',
    accessibilityNote:
      'Angaben gemäß §14 BFSG. Abschnitt 3 listet auf, was noch nicht barrierefrei ist — das ist der Teil, der sich zu lesen lohnt.',
    cookieTitle: 'Cookies, die wir setzen',
    cookieNote:
      'Nach §25 TDDDG ist alles, was über das technisch Notwendige hinausgeht, einwilligungspflichtig. Dies ist die vollständige Liste.',
    cookieColumnName: 'Name',
    cookieColumnPurpose: 'Zweck',
    cookieColumnDuration: 'Dauer',
    cookieColumnCategory: 'Kategorie',
  },

  about: {
    eyebrow: 'Über uns',
    title: 'Von Leuten gebaut, die selbst an der Linie standen.',
    lede: 'Beff ist ein Ingenieurunternehmen für die Lithium-Ionen-Batterieindustrie — von der Zellauslegung über den Prototypenbau bis zum Hochlauf der Serienfertigung. Dieses Produkt ist ein Teil dieser Arbeit, in Software übersetzt.',

    originTitle: 'Woher das kommt',
    originBody:
      'Beff wurde von Ingenieuren gegründet, die jahrelang in der Lithium-Ionen-Batterieindustrie gearbeitet haben: Zellen ausgelegt, Fertigungslinien hochgefahren und internationale Märkte aus erster Hand kennengelernt.',
    originBodyTwo:
      'Das ist der Grund, warum dieses Produkt über gebundenen Wert argumentiert und nicht über Prozentwerte. Eine in der Formierung ausgeschleuste Zelle und eine in der Beschichtung ausgeschleuste Zelle sind nicht dasselbe Ereignis — und jedes Dashboard, das beides als Verlustquote ausweist, wirft genau das weg, was jeder in der Fertigung ohnehin weiß.',

    whereTitle: 'Wo wir sind',
    stuttgart: 'Stuttgart, Deutschland',
    stuttgartRole: 'Europäische Zentrale',
    tokyo: 'Tokio, Japan',
    tokyoRole: 'Zentrale Asien-Pazifik',

    prelaunchTitle: 'Was heute gilt',
    prelaunchBody:
      'Dieses Produkt ist noch nicht auf dem Markt. Es gibt keinen kostenpflichtigen Tarif, keine Kundenliste und keine Fallstudie — und sich davon etwas auszudenken, würde jedem auffallen, der an einer Zellfertigung arbeitet. Was es gibt: eine Warteliste, ein Konto zum Ansehen und Zahlen auf dieser Website, die durchgehend in den Bereichen bleiben, die eine echte Pilot- oder Serienlinie liefert.',
  },

  common: {
    loading: 'Wird geladen …',
    required: 'Pflichtfeld',
    dismiss: 'Schließen',
  },

  a11y: {
    alertPrefixes: {
      info: 'Hinweis',
      success: 'Erfolg',
      warning: 'Warnung',
      danger: 'Fehler',
    },
    trend: {
      up: 'gestiegen',
      down: 'gefallen',
      flat: 'unverändert',
    },
    /**
     * "In der Spezifikation" rather than a literal "in Spezifikation": this is
     * the wording a German quality engineer uses on a Prüfprotokoll, and the
     * point of the readout is that it sounds like the domain rather than like a
     * translation of it.
     */
    specBand: {
      inSpec: 'in der Spezifikation',
      aboveUpper: 'außerhalb der Spezifikation, über der oberen Grenze',
      belowLower: 'außerhalb der Spezifikation, unter der unteren Grenze',
      specification: 'Spezifikation',
      target: 'Ziel',
    },
  },

  errors: {
    notFoundTitle: 'Diese Seite gibt es nicht',
    notFoundBody:
      'Der Link ist möglicherweise veraltet oder die Adresse enthält einen Tippfehler. Auf unserer Seite ist nichts schiefgegangen.',
    backHome: 'Zurück zum Anfang',
    unexpectedTitle: 'Etwas ist schiefgegangen',
    unexpectedBody:
      'Das liegt an uns, nicht an Ihnen. Ein erneuter Versuch hilft oft — der Fehler war möglicherweise nur vorübergehend.',
    tryAgain: 'Erneut versuchen',
    reference: 'Referenz für den Support:',
  },

  fieldErrors: {
    required: 'Dieses Feld ist ein Pflichtfeld.',
    invalid_email: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
    already_registered: 'Diese Adresse steht bereits auf der Liste.',
    too_long: 'Das ist länger, als wir speichern können.',
    too_short: 'Das ist zu kurz.',
    weak_password: 'Wählen Sie ein längeres Passwort — mindestens 12 Zeichen.',
    unknown: 'Bitte prüfen Sie dieses Feld.',
  },
};
