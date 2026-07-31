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
    theme: 'Darstellung',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    themeSystem: 'System',
  },

  landing: {
    eyebrow: 'Vor dem Marktstart',
    headline: 'Ausschuss erkennen, bevor er die Formierung erreicht.',
    subhead:
      'Eine Zelle, die in der Formierung ausgeschleust wird, hat bereits alle vorgelagerten Kosten aufgenommen. Beff zeigt, wo die Erstdurchlaufquote verloren geht, an welchem Prozessschritt und was das wert ist — aus den Daten, die Ihre Linie ohnehin erzeugt.',
    ctaPrimary: 'Zugang anfragen',
    ctaSecondary: 'Was gemessen wird',

    problemTitle: 'Die Daten sind längst da. Verteilt auf vierzehn Tabellen.',
    problemBody:
      'Schichtdicken in einem Export, Formierungsergebnisse in einem anderen, Ausschuss schichtweise auf Papier. Bis das Bild zusammengesetzt ist, ist die Charge ausgeliefert und die Antwort drei Wochen alt.',

    valueTitle: 'Das bekommen Sie',
    values: [
      {
        title: 'Ausbeute je Prozessschritt',
        body: 'Die Erstdurchlaufquote aufgeschlüsselt vom Mischen bis zur Endprüfung — gewichtet, damit späte Verluste als das erscheinen, was sie sind: die teuren.',
      },
      {
        title: 'Ausschuss in Euro, nicht in Prozent',
        body: '2 % Verlust beim Kalandrieren und 2 % Verlust in der Formierung sind nicht dasselbe Ereignis. Ausschuss wird gegen die bis dahin gebundene Wertschöpfung bewertet.',
      },
      {
        title: 'CO₂ pro kWh, nachverfolgt',
        body: 'Emissionsintensität je erzeugter Energieeinheit, mitlaufend mit Ihrer tatsächlichen Ausbeute — die Kennzahl, die Ihre Kunden zunehmend schriftlich verlangen.',
      },
    ],

    signatureTitle: 'Aufgebaut auf dem Toleranzband',
    signatureBody:
      'Jeder Messwert steht in Beff vor seinem Spezifikationsfenster — so, wie ihn eine Regelkarte oder ein Kalibrierschein ohnehin zeigt. In der Spezifikation, außerhalb, und um wie viel. Auf einen Blick lesbar, und auch ohne Farbe lesbar.',
    signatureExampleLabel: 'Elektrodenporosität nach dem Kalandrieren',

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
  },

  common: {
    loading: 'Wird geladen …',
    required: 'Pflichtfeld',
    dismiss: 'Schließen',
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
