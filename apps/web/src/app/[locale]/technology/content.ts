import type { ProcessStep } from '@/lib/metrics';
import type { Locale } from '@/lib/i18n';

/**
 * One stage of getting a line's data into an answer.
 *
 * The ordinals are earned the same way the landing page's are: this is a real
 * ordered sequence where you cannot do step three before step two. Numbering a
 * three-column feature grid `01 / 02 / 03` because it looks considered is
 * exactly the decoration the design brief rules out — the markers mean
 * "position N in a real sequence", or they mean nothing.
 *
 * `anchorStep` ties each stage to a step in the production chain, so the page
 * borrows its structure from the same source the dashboard does rather than
 * inventing a parallel one.
 */
interface Stage {
  ordinal: string;
  anchorStep: ProcessStep;
  title: string;
  body: string;
  detail: readonly string[];
}

interface TechnologyContent {
  eyebrow: string;
  title: string;
  lede: string;
  stages: readonly Stage[];
  builtTitle: string;
  builtBody: string;
  builtPoints: readonly string[];
  notBuiltTitle: string;
  notBuiltPoints: readonly string[];
}

export const TECHNOLOGY_CONTENT: Record<Locale, TechnologyContent> = {
  en: {
    eyebrow: 'Technology',
    title: 'From a line export to an answer, in three steps.',
    lede: 'No PLC integration, no gateway hardware, no six-month IT project before the first number appears. Beff starts from the exports your line already produces, because a pre-launch product that requires a control-system integration never gets evaluated at all.',

    stages: [
      {
        ordinal: '01',
        anchorStep: 'mixing',
        title: 'Connect what already leaves the line',
        body: 'MES and LIMS exports, coating logs, formation results, end-of-line test records. CSV to begin with, because every plant can produce one this afternoon and nobody needs to open a firewall for it.',
        detail: [
          'Uploads are per line and per batch, so a reading always knows which line and which batch it came from.',
          'Nothing is inferred from a filename. Line, batch and process step are explicit or the row is rejected.',
        ],
      },
      {
        ordinal: '02',
        anchorStep: 'calendering',
        title: 'Type it against the chain',
        body: 'Every reading is attached to one of twelve process steps, in order, and to the specification window that step is held to. That ordering is what lets the same two-per-cent loss be cheap at coating and ruinous at formation.',
        detail: [
          'Process steps are a closed set matching the schema and the domain vocabulary exactly — prose variants are a bug, not a synonym.',
          'Committed value per step is derived from the seeded cost model, so the marketing figures and the product’s figures cannot drift apart.',
          'A measurement with no specification window is stored but never charted. A band with invented limits is worse than no band.',
        ],
      },
      {
        ordinal: '03',
        anchorStep: 'eol_test',
        title: 'Read it against its limits',
        body: 'Yield against its window, scrap weighted by what each step had already committed, and every measurement drawn against its own tolerance band. The question is where the loss is, and the answer is a position in the chain.',
        detail: [
          'Every chart has a data table behind it and a non-colour encoding, so the answer survives a screen reader, greyscale and a printout.',
          'Exports are machine-readable JSON, and they exclude password hashes and any third party’s data.',
        ],
      },
    ],

    builtTitle: 'What is running today',
    builtBody:
      'This is a working system, not a prototype behind a form. Everything below is in the repository and exercised by tests on every commit.',
    builtPoints: [
      'FastAPI backend on PostgreSQL, with authentication owned end to end and refresh tokens stored hashed.',
      'Background work on a Postgres-backed queue using SELECT … FOR UPDATE SKIP LOCKED — retries, idempotency and a dead-letter path without a second datastore to run and monitor.',
      'GDPR built in rather than bolted on: append-only consent records, machine-readable export, erasure that frees the email for re-registration.',
      'Accessibility gated in CI at WCAG 2.2 AA, with contrast proven at the design-token level before any component can use a pair.',
    ],

    notBuiltTitle: 'What is not',
    notBuiltPoints: [
      'No live connection to a line or a PLC. Data arrives as an upload.',
      'No alerting, no scheduled reports, no multi-plant rollup.',
      'One seeded pilot line. The figures on this site are that line’s figures.',
    ],
  },

  de: {
    eyebrow: 'Technologie',
    title: 'Vom Linienexport zur Antwort, in drei Schritten.',
    lede: 'Keine SPS-Anbindung, keine Gateway-Hardware, kein halbjähriges IT-Projekt, bevor die erste Zahl erscheint. Beff setzt auf den Exporten auf, die Ihre Linie ohnehin erzeugt — denn ein Produkt vor dem Marktstart, das eine Leitsystemintegration voraussetzt, wird nie evaluiert.',

    stages: [
      {
        ordinal: '01',
        anchorStep: 'mixing',
        title: 'Anbinden, was die Linie ohnehin verlässt',
        body: 'MES- und LIMS-Exporte, Beschichtungsprotokolle, Formierungsergebnisse, Endprüfdaten. Zunächst als CSV, weil jedes Werk eine solche Datei noch heute Nachmittag erzeugen kann und dafür niemand eine Firewall öffnen muss.',
        detail: [
          'Uploads erfolgen je Linie und je Charge, damit ein Messwert immer weiß, aus welcher Linie und welcher Charge er stammt.',
          'Nichts wird aus einem Dateinamen abgeleitet. Linie, Charge und Prozessschritt stehen explizit da, sonst wird die Zeile abgewiesen.',
        ],
      },
      {
        ordinal: '02',
        anchorStep: 'calendering',
        title: 'Der Prozesskette zuordnen',
        body: 'Jeder Messwert hängt an einem von zwölf Prozessschritten, in ihrer Reihenfolge, und an dem Spezifikationsfenster, das für diesen Schritt gilt. Diese Reihenfolge ist der Grund, warum derselbe Zwei-Prozent-Verlust beim Coating günstig und in der Formierung ruinös ist.',
        detail: [
          'Die Prozessschritte sind eine geschlossene Menge, die exakt dem Schema und der Fachsprache entspricht — Schreibvarianten sind ein Fehler, kein Synonym.',
          'Die gebundene Wertschöpfung je Schritt stammt aus dem hinterlegten Kostenmodell, damit die Zahlen im Marketing und die Zahlen im Produkt nicht auseinanderlaufen können.',
          'Ein Messwert ohne Spezifikationsfenster wird gespeichert, aber nie als Band gezeichnet. Ein Band mit erfundenen Grenzen ist schlechter als gar keines.',
        ],
      },
      {
        ordinal: '03',
        anchorStep: 'eol_test',
        title: 'Vor den Grenzen lesen',
        body: 'Die Ausbeute vor ihrem Fenster, der Ausschuss gewichtet nach dem, was jeder Schritt bereits gebunden hatte, und jeder Messwert vor seinem eigenen Toleranzband. Die Frage lautet, wo der Verlust entsteht — und die Antwort ist eine Position in der Kette.',
        detail: [
          'Hinter jedem Diagramm liegt eine Datentabelle und eine Kodierung ohne Farbe, damit die Antwort Screenreader, Graustufen und Ausdruck übersteht.',
          'Exporte sind maschinenlesbares JSON und enthalten weder Passwort-Hashes noch Daten Dritter.',
        ],
      },
    ],

    builtTitle: 'Was heute läuft',
    builtBody:
      'Das ist ein laufendes System, kein Prototyp hinter einem Formular. Alles Folgende liegt im Repository und wird bei jedem Commit durch Tests abgedeckt.',
    builtPoints: [
      'FastAPI-Backend auf PostgreSQL, Authentifizierung durchgängig selbst verantwortet, Refresh-Token nur gehasht gespeichert.',
      'Hintergrundverarbeitung über eine Postgres-Warteschlange mit SELECT … FOR UPDATE SKIP LOCKED — Wiederholungen, Idempotenz und ein Dead-Letter-Pfad ohne zweiten Datenspeicher im Betrieb.',
      'DSGVO von Anfang an mitgebaut: unveränderliche Einwilligungsnachweise, maschinenlesbarer Export, Löschung, die die E-Mail-Adresse für eine Neuregistrierung wieder freigibt.',
      'Barrierefreiheit als CI-Gate nach WCAG 2.2 AA, mit Kontrasten, die auf Token-Ebene nachgewiesen sind, bevor eine Komponente ein Farbpaar verwenden darf.',
    ],

    notBuiltTitle: 'Was nicht',
    notBuiltPoints: [
      'Keine Live-Anbindung an eine Linie oder eine SPS. Daten kommen als Upload.',
      'Keine Alarmierung, keine terminierten Berichte, keine werksübergreifende Verdichtung.',
      'Eine eingespielte Pilotlinie. Die Zahlen auf dieser Website sind deren Zahlen.',
    ],
  },
};
