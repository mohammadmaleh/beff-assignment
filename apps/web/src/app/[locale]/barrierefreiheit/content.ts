import type { LegalDocument } from '@/components/LegalShell';
import type { Locale } from '@/lib/i18n';

/**
 * Barrierefreiheitserklärung — accessibility statement.
 *
 * ## Why it is here
 *
 * The BFSG (in force since 28 June 2025) obliges providers of covered services
 * to publish one. Whether it strictly binds a pre-launch B2B tool is arguable —
 * the Act is aimed at consumer-facing services, and §3(3) exempts micro
 * enterprises for services. It is published anyway, because the argument for
 * omitting it is "we probably do not have to", which is not a good look on the
 * one subject this project has spent the most effort on.
 *
 * ## The part that matters
 *
 * Section 3. A conformance statement that lists nothing non-conforming is not a
 * statement, it is a marketing claim in a legal document's clothing — and it is
 * the single most common failure of the genre. Every entry below is a real,
 * currently-true limitation, and each one is also recorded in the README's "Not
 * done, and not claimed" section. **If those two lists ever disagree, one of
 * them is lying**, exactly as with the Art. 30 register and the privacy table.
 *
 * When the company film gets a `.vtt`, the first entry comes out of both.
 */
export const ACCESSIBILITY_CONTENT: Record<Locale, LegalDocument> = {
  en: [
    {
      id: 'scope',
      heading: '1. Scope',
      paragraphs: [
        'This statement applies to the Beff website and the signed-in application at this domain.',
      ],
    },
    {
      id: 'status',
      heading: '2. Conformance status',
      paragraphs: [
        'Target: WCAG 2.2 level AA.',
        'Status: partially conformant. "Partially conformant" means most of the standard is met, with the specific exceptions listed below.',
      ],
    },
    {
      id: 'exceptions',
      heading: '3. Content that is not yet accessible',
      paragraphs: [
        'The company introduction film has an audio track and ships without captions or an audio description. This does not meet WCAG 1.2.2 (A) or 1.2.5 (AA). No transcript was available for the film and we chose not to write one from guesswork, because inaccurate captions are worse than none. The text beside the video states what the film covers.',
        'No human has tested this site with NVDA, JAWS or VoiceOver. Automated checks and an audit of the browser accessibility tree cover roughly 30–50% of real barriers; the rest need a person listening. That work has not happened.',
        'Automated testing covers Chromium only. WebKit and mobile screen readers are untested.',
        'The signed-in surfaces are not covered by the automated accessibility suite, which runs without a database.',
      ],
    },
    {
      id: 'measures',
      heading: '4. What is in place',
      paragraphs: [
        'Accessibility is gated in the build rather than reviewed at the end: axe-core runs against WCAG 2.2 AA on every marketing surface in both languages and in both colour themes, keyboard paths are asserted, colour-contrast pairs are proven against the design tokens before any component uses them, and no chart conveys meaning by colour alone — each has a data-table alternative.',
        'Motion respects prefers-reduced-motion, including animation delays, which is a common omission.',
      ],
    },
    {
      id: 'preparation',
      heading: '5. How this statement was prepared',
      paragraphs: [
        'Prepared on 3 August 2026 by self-assessment, supported by automated testing and a manual audit of the accessibility tree. It has not been reviewed by an external body.',
      ],
    },
    {
      id: 'feedback',
      heading: '6. Feedback',
      paragraphs: [
        'If you hit a barrier on this site, please tell us at barrierefreiheit@example.invalid. Describe the page and what happened, and we will respond within two weeks.',
      ],
    },
    {
      id: 'enforcement',
      heading: '7. Enforcement procedure',
      paragraphs: [
        'If our response does not satisfy you, you can contact the conciliation body under §21 BFSG (Schlichtungsstelle nach dem Behindertengleichstellungsgesetz), which mediates disputes about accessibility free of charge.',
      ],
    },
  ],

  de: [
    {
      id: 'scope',
      heading: '1. Geltungsbereich',
      paragraphs: [
        'Diese Erklärung gilt für die Website von Beff sowie für die angemeldete Anwendung unter dieser Domain.',
      ],
    },
    {
      id: 'status',
      heading: '2. Stand der Vereinbarkeit',
      paragraphs: [
        'Ziel: WCAG 2.2 Stufe AA.',
        'Stand: teilweise vereinbar. „Teilweise vereinbar" bedeutet, dass der Standard überwiegend erfüllt ist, mit den unten aufgeführten Ausnahmen.',
      ],
    },
    {
      id: 'exceptions',
      heading: '3. Nicht barrierefreie Inhalte',
      paragraphs: [
        'Der Unternehmensfilm enthält eine Tonspur und wird ohne Untertitel und ohne Audiodeskription ausgeliefert. Das erfüllt WCAG 1.2.2 (A) und 1.2.5 (AA) nicht. Für den Film lag kein Transkript vor, und wir haben bewusst darauf verzichtet, eines zu erfinden, weil unzutreffende Untertitel schlechter sind als keine. Der Text neben dem Video beschreibt, was der Film zeigt.',
        'Diese Website wurde von keinem Menschen mit NVDA, JAWS oder VoiceOver getestet. Automatisierte Prüfungen und die Auswertung des Accessibility-Baums erfassen etwa 30–50 % der tatsächlichen Barrieren; für den Rest braucht es jemanden, der zuhört. Diese Prüfung hat nicht stattgefunden.',
        'Die automatisierten Tests laufen ausschließlich unter Chromium. WebKit und mobile Screenreader sind ungetestet.',
        'Die angemeldeten Bereiche sind von der automatisierten Barrierefreiheitsprüfung nicht erfasst, da diese ohne Datenbank läuft.',
      ],
    },
    {
      id: 'measures',
      heading: '4. Was umgesetzt ist',
      paragraphs: [
        'Barrierefreiheit ist Teil des Build-Prozesses und keine nachgelagerte Prüfung: axe-core testet jede Marketingseite in beiden Sprachen und in beiden Farbschemata gegen WCAG 2.2 AA, Tastaturpfade werden geprüft, Farbkontraste werden auf Token-Ebene nachgewiesen, bevor eine Komponente sie verwendet, und keine Grafik vermittelt Bedeutung allein über Farbe — zu jeder gibt es eine Datentabelle.',
        'Bewegung berücksichtigt prefers-reduced-motion einschließlich der Verzögerungen, was häufig übersehen wird.',
      ],
    },
    {
      id: 'preparation',
      heading: '5. Erstellung dieser Erklärung',
      paragraphs: [
        'Erstellt am 3. August 2026 im Wege der Selbstbewertung, gestützt auf automatisierte Tests und eine manuelle Auswertung des Accessibility-Baums. Eine Prüfung durch eine externe Stelle ist nicht erfolgt.',
      ],
    },
    {
      id: 'feedback',
      heading: '6. Rückmeldung',
      paragraphs: [
        'Wenn Sie auf dieser Website auf eine Barriere stoßen, schreiben Sie uns an barrierefreiheit@example.invalid. Beschreiben Sie die Seite und was passiert ist — wir antworten innerhalb von zwei Wochen.',
      ],
    },
    {
      id: 'enforcement',
      heading: '7. Durchsetzungsverfahren',
      paragraphs: [
        'Falls unsere Antwort Sie nicht zufriedenstellt, können Sie sich an die Schlichtungsstelle nach §21 BFSG (Schlichtungsstelle nach dem Behindertengleichstellungsgesetz) wenden. Das Schlichtungsverfahren ist kostenlos.',
      ],
    },
  ],
};
