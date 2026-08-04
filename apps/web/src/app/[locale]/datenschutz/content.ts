import type { Locale } from '@/lib/i18n';

interface ProcessingRow {
  purpose: string;
  data: string;
  basis: string;
  retention: string;
}

/**
 * One thing stored on the reader's device.
 *
 * Not "one cookie". §25 TDDDG governs *storing information on, or accessing
 * information from, terminal equipment* — the mechanism is irrelevant, so
 * `localStorage` is covered exactly as a cookie is. Cookie tables that list only
 * cookies are the single most common way this obligation is missed, and the two
 * entries this site would have omitted are the two it actually relies on.
 */
interface StorageRow {
  name: string;
  kind: string;
  purpose: string;
  duration: string;
  /** Strictly necessary, or consent-requiring. There is no third category. */
  category: string;
}

interface PrivacyContent {
  controllerTitle: string;
  processingTitle: string;
  columnPurpose: string;
  columnData: string;
  columnBasis: string;
  columnRetention: string;
  processing: readonly ProcessingRow[];
  storageTitle: string;
  storageNote: string;
  columnName: string;
  columnKind: string;
  columnDuration: string;
  columnCategory: string;
  storage: readonly StorageRow[];
  rightsTitle: string;
  rights: readonly string[];
  noTrackingTitle: string;
  noTrackingBody: string;
}

/**
 * Kept out of the shared dictionary because it is a document, not interface
 * copy. It changes on a legal review cycle rather than a product one, and
 * mixing the two makes both harder to keep honest.
 *
 * The rows mirror the Art. 30 register in the README. If they ever disagree,
 * one of the two is a lie.
 */
export const PRIVACY_CONTENT: Record<Locale, PrivacyContent> = {
  en: {
    controllerTitle: 'Controller',
    processingTitle: 'What we process, why, and for how long',
    columnPurpose: 'Purpose',
    columnData: 'Data',
    columnBasis: 'Legal basis',
    columnRetention: 'Retention',
    processing: [
      {
        purpose: 'Providing your account',
        data: 'Email address, name, password hash',
        basis: 'Art. 6(1)(b) — performance of a contract',
        retention: 'Until you delete the account, then erased',
      },
      {
        purpose: 'Keeping you signed in',
        data: 'Session and refresh tokens, stored hashed',
        basis: 'Art. 6(1)(b) — performance of a contract',
        retention: '30 days from last use',
      },
      {
        purpose: 'Access requests from the waiting list',
        data: 'Work email, company name',
        basis: 'Art. 6(1)(a) — consent',
        retention: '24 months, or until you ask us to remove it',
      },
      {
        purpose: 'Proving what you consented to',
        data: 'Consent records: purpose, policy version, timestamp, hashed IP and country',
        basis: 'Art. 6(1)(c) — legal obligation (Art. 7(1) accountability)',
        retention: '3 years after the consent ends',
      },
      {
        purpose: 'Analytics, if you allow it',
        data: 'Anonymous page-view counts',
        basis: 'Art. 6(1)(a) — consent, withdrawable at any time',
        retention: '14 months',
      },
    ],
    storageTitle: 'What we store on your device',
    storageNote:
      '§25 TDDDG covers anything stored on or read from your device, not only cookies — so browser storage is listed here too. Nothing below is used for advertising, and nothing is shared with a third party.',
    columnName: 'Name',
    columnKind: 'Kind',
    columnDuration: 'Duration',
    columnCategory: 'Category',
    storage: [
      {
        name: 'beff_refresh_token',
        kind: 'Cookie, httpOnly, SameSite=Lax, scoped to /api/v1/auth',
        purpose: 'Keeps you signed in between visits. Stored hashed on our side.',
        duration: '30 days',
        category: 'Strictly necessary',
      },
      {
        name: 'beff-cookie-consent',
        kind: 'Local storage',
        purpose:
          'Remembers the choice you made in the cookie panel, so you are not asked again on every page.',
        duration: 'Until you clear it or change your choice',
        category: 'Strictly necessary',
      },
      {
        name: 'beff-theme',
        kind: 'Local storage',
        purpose:
          'Remembers whether you chose the light or dark appearance. Absent unless you pick one — by default we follow your operating system.',
        duration: 'Until you clear it',
        category: 'Strictly necessary',
      },
      {
        name: '— none —',
        kind: 'Analytics',
        purpose:
          'No analytics tool is loaded on this site today. The panel still asks, because your answer is recorded before anything could be added, and consent gathered afterwards is consent nobody gave.',
        duration: 'Not applicable',
        category: 'Consent required',
      },
    ],
    rightsTitle: 'Your rights',
    rights: [
      'Access (Art. 15) — a copy of your data. Available as a machine-readable export from your profile.',
      'Rectification (Art. 16) — correct anything wrong, from your profile.',
      'Erasure (Art. 17) — delete your account and everything attached to it. Also from your profile, and it is not reversible.',
      'Portability (Art. 20) — the same export, in JSON, to take elsewhere.',
      'Withdraw consent (Art. 7(3)) — as easily as you gave it. The cookie panel reopens from this page.',
      'Complain to a supervisory authority (Art. 77) — for Stuttgart, the Landesbeauftragte für den Datenschutz Baden-Württemberg.',
    ],
    noTrackingTitle: 'No third-country transfers, and no fonts from Google',
    noTrackingBody:
      'Typefaces are served from our own infrastructure. Embedding Google Fonts transmits the visitor’s IP address to a US server, which LG München I found unlawful (3 O 17493/20). Your IP address is never stored raw anywhere in this product — consent records keep a salted hash and a country code only.',
  },
  de: {
    controllerTitle: 'Verantwortlicher',
    processingTitle: 'Was wir verarbeiten, wozu und wie lange',
    columnPurpose: 'Zweck',
    columnData: 'Daten',
    columnBasis: 'Rechtsgrundlage',
    columnRetention: 'Speicherdauer',
    processing: [
      {
        purpose: 'Bereitstellung Ihres Kontos',
        data: 'E-Mail-Adresse, Name, Passwort-Hash',
        basis: 'Art. 6 Abs. 1 lit. b — Vertragserfüllung',
        retention: 'Bis zur Löschung des Kontos, dann Löschung',
      },
      {
        purpose: 'Angemeldet bleiben',
        data: 'Sitzungs- und Refresh-Token, gehasht gespeichert',
        basis: 'Art. 6 Abs. 1 lit. b — Vertragserfüllung',
        retention: '30 Tage ab letzter Nutzung',
      },
      {
        purpose: 'Zugangsanfragen von der Warteliste',
        data: 'Geschäftliche E-Mail-Adresse, Unternehmensname',
        basis: 'Art. 6 Abs. 1 lit. a — Einwilligung',
        retention: '24 Monate oder bis zu Ihrem Widerruf',
      },
      {
        purpose: 'Nachweis Ihrer Einwilligung',
        data: 'Einwilligungsnachweise: Zweck, Fassung der Erklärung, Zeitstempel, gehashte IP und Land',
        basis:
          'Art. 6 Abs. 1 lit. c — rechtliche Verpflichtung (Rechenschaftspflicht, Art. 7 Abs. 1)',
        retention: '3 Jahre nach Ende der Einwilligung',
      },
      {
        purpose: 'Analyse, sofern Sie zustimmen',
        data: 'Anonyme Seitenaufrufe',
        basis: 'Art. 6 Abs. 1 lit. a — Einwilligung, jederzeit widerrufbar',
        retention: '14 Monate',
      },
    ],
    storageTitle: 'Was wir auf Ihrem Gerät speichern',
    storageNote:
      '§25 TDDDG erfasst alles, was auf Ihrem Gerät gespeichert oder von dort ausgelesen wird — nicht nur Cookies. Deshalb steht der Browser-Speicher hier ebenfalls. Nichts davon dient Werbezwecken, nichts wird an Dritte weitergegeben.',
    columnName: 'Name',
    columnKind: 'Art',
    columnDuration: 'Dauer',
    columnCategory: 'Kategorie',
    storage: [
      {
        name: 'beff_refresh_token',
        kind: 'Cookie, httpOnly, SameSite=Lax, beschränkt auf /api/v1/auth',
        purpose: 'Hält Sie zwischen Besuchen angemeldet. Bei uns nur gehasht gespeichert.',
        duration: '30 Tage',
        category: 'Technisch notwendig',
      },
      {
        name: 'beff-cookie-consent',
        kind: 'Local Storage',
        purpose:
          'Merkt sich Ihre Auswahl im Cookie-Panel, damit Sie nicht auf jeder Seite erneut gefragt werden.',
        duration: 'Bis Sie ihn löschen oder Ihre Auswahl ändern',
        category: 'Technisch notwendig',
      },
      {
        name: 'beff-theme',
        kind: 'Local Storage',
        purpose:
          'Merkt sich, ob Sie die helle oder dunkle Darstellung gewählt haben. Wird nur gesetzt, wenn Sie aktiv wählen — standardmäßig folgen wir Ihrem Betriebssystem.',
        duration: 'Bis Sie ihn löschen',
        category: 'Technisch notwendig',
      },
      {
        name: '— keine —',
        kind: 'Analyse',
        purpose:
          'Auf dieser Website ist derzeit kein Analysewerkzeug eingebunden. Das Panel fragt trotzdem, weil Ihre Antwort erfasst wird, bevor etwas hinzukommen könnte — nachträglich eingeholte Einwilligung ist keine.',
        duration: 'Nicht zutreffend',
        category: 'Einwilligung erforderlich',
      },
    ],
    rightsTitle: 'Ihre Rechte',
    rights: [
      'Auskunft (Art. 15) — eine Kopie Ihrer Daten. Als maschinenlesbarer Export in Ihrem Profil abrufbar.',
      'Berichtigung (Art. 16) — Unrichtiges korrigieren, direkt im Profil.',
      'Löschung (Art. 17) — Konto und alles daran Hängende löschen. Ebenfalls im Profil, und nicht umkehrbar.',
      'Datenübertragbarkeit (Art. 20) — derselbe Export, als JSON, zur Mitnahme.',
      'Widerruf der Einwilligung (Art. 7 Abs. 3) — so einfach wie die Erteilung. Das Cookie-Panel lässt sich von dieser Seite erneut öffnen.',
      'Beschwerde bei einer Aufsichtsbehörde (Art. 77) — für Stuttgart: Landesbeauftragte für den Datenschutz Baden-Württemberg.',
    ],
    noTrackingTitle: 'Keine Drittlandsübermittlung, keine Schriften von Google',
    noTrackingBody:
      'Schriftarten werden von unserer eigenen Infrastruktur ausgeliefert. Die Einbindung von Google Fonts überträgt die IP-Adresse der Besucherin an einen US-Server; das LG München I hat dies für rechtswidrig erklärt (3 O 17493/20). Ihre IP-Adresse wird in diesem Produkt nirgends im Klartext gespeichert — Einwilligungsnachweise enthalten nur einen gesalzenen Hash und ein Länderkürzel.',
  },
};
