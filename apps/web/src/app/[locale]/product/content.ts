import type { Locale } from '@/lib/i18n';

/**
 * One measurement the product reads, with its specification window.
 *
 * Every value here sits inside the ranges in `CONTEXT.md`, and that is a hard
 * rule rather than a nicety: a 99.8% first-pass yield on a pilot line is not
 * impressive, it is obviously wrong, and it discredits every other number on the
 * page for the one reader this site is written for.
 */
interface Measurement {
  label: string;
  value: number;
  lowerLimit: number;
  upperLimit: number;
  target: number;
  unit: string;
  /** Why an engineer cares about this one, in a sentence. */
  note: string;
}

interface ProductContent {
  eyebrow: string;
  title: string;
  lede: string;
  measuresTitle: string;
  measuresBody: string;
  measurements: readonly Measurement[];
  readingTitle: string;
  readingBody: string;
  readingPoints: readonly string[];
  honestTitle: string;
  honestBody: string;
}

export const PRODUCT_CONTENT: Record<Locale, ProductContent> = {
  en: {
    eyebrow: 'Product',
    title: 'A value alone is meaningless. A value against its band is the answer.',
    lede: 'Beff reads the measurements a cell line already produces and shows each one against the window it is specified to. Not a number with an arrow beside it — a reading against a limit, the way a control chart shows it.',

    measuresTitle: 'What it measures',
    measuresBody:
      'Five families, all of them in the vocabulary your line already uses. The readings below are from the demo pilot line and sit inside the ranges a real one produces.',
    measurements: [
      {
        label: 'First-pass yield',
        value: 91.2,
        lowerLimit: 85,
        upperLimit: 97,
        target: 93,
        unit: '%',
        note: 'Cells passing end-of-line test without rework. A mature line specifies 85 to 97 per cent; a pilot line runs 40 to 80 and is not comparable to it.',
      },
      {
        label: 'Electrode porosity after calendering',
        value: 32.4,
        lowerLimit: 30,
        upperLimit: 35,
        target: 32.5,
        unit: '%',
        note: 'Set by the calender, and the reason a drift here shows up as a capacity problem four steps later rather than as a coating problem now.',
      },
      {
        label: 'Areal loading',
        value: 21.8,
        lowerLimit: 18,
        upperLimit: 24,
        target: 21,
        unit: 'mg/cm²',
        note: 'Active material per unit electrode area. Drives capacity, and drives scrap when the coater wanders.',
      },
      {
        label: 'Energy density',
        value: 238,
        lowerLimit: 240,
        upperLimit: 265,
        target: 252,
        unit: 'Wh/kg',
        note: 'Out of spec, below the lower limit — the case the band exists for. The number is 0.8 per cent short, which a percentage-change readout would round away.',
      },
      {
        label: 'Capacity retention at 1000 cycles',
        value: 88.3,
        lowerLimit: 80,
        upperLimit: 100,
        target: 90,
        unit: '%',
        note: 'Eighty per cent at a thousand cycles is a common end-of-life threshold for automotive cells. Above it is a pass, and how far above it is the margin.',
      },
    ],

    readingTitle: 'How a reading is drawn',
    readingBody:
      'The spec band is the one element the product is remembered by, and it appears wherever a real measurement meets a real limit — nowhere else. It encodes its meaning by position, which is also the honest answer to charts that fail for colour-blind readers.',
    readingPoints: [
      'The tolerance window is drawn as a filled segment; the measured value is a tick against it. Position carries the meaning, so the reading survives greyscale, a projector and a printout.',
      'Colour is a second signal, never the only one. The status words — in spec, near limit, out of spec — are spoken, not implied by a hue.',
      'Every chart has a data table behind it, disclosed rather than hidden, so a screen reader gets the figures and not a description of a picture.',
      'Figures are set in tabular numerals so a value does not jitter sideways between reads.',
    ],

    honestTitle: 'What is not here yet',
    honestBody:
      'There is no live line connection, no alerting and no multi-plant rollup. The dashboard runs on a seeded pilot line, and the figures on this site are that line’s. When those arrive they will be described the same way: what it does, on what data, with what limits.',
  },

  de: {
    eyebrow: 'Produkt',
    title: 'Ein Wert allein sagt nichts. Ein Wert vor seinem Band ist die Antwort.',
    lede: 'Beff liest die Messwerte, die eine Zellfertigung ohnehin erzeugt, und stellt jeden vor sein Spezifikationsfenster. Keine Zahl mit einem Pfeil daneben — ein Messwert vor seiner Grenze, so wie ihn eine Regelkarte zeigt.',

    measuresTitle: 'Was gemessen wird',
    measuresBody:
      'Fünf Größen, alle in der Sprache, die Ihre Linie ohnehin verwendet. Die Werte unten stammen von der Demo-Pilotlinie und liegen in den Bereichen, die eine echte Linie liefert.',
    measurements: [
      {
        label: 'Erstdurchlaufquote',
        value: 91.2,
        lowerLimit: 85,
        upperLimit: 97,
        target: 93,
        unit: '%',
        note: 'Zellen, die die Endprüfung ohne Nacharbeit bestehen. Eine Serienlinie ist auf 85 bis 97 Prozent spezifiziert; eine Pilotlinie läuft bei 40 bis 80 und ist damit nicht vergleichbar.',
      },
      {
        label: 'Elektrodenporosität nach dem Kalandrieren',
        value: 32.4,
        lowerLimit: 30,
        upperLimit: 35,
        target: 32.5,
        unit: '%',
        note: 'Wird vom Kalander eingestellt — und der Grund, warum eine Abweichung hier vier Schritte später als Kapazitätsproblem auftaucht und nicht jetzt als Beschichtungsproblem.',
      },
      {
        label: 'Flächenbeladung',
        value: 21.8,
        lowerLimit: 18,
        upperLimit: 24,
        target: 21,
        unit: 'mg/cm²',
        note: 'Aktivmaterial je Elektrodenfläche. Bestimmt die Kapazität — und den Ausschuss, sobald die Beschichtungsanlage wandert.',
      },
      {
        label: 'Energiedichte',
        value: 238,
        lowerLimit: 240,
        upperLimit: 265,
        target: 252,
        unit: 'Wh/kg',
        note: 'Außerhalb der Spezifikation, unterhalb der Untergrenze — genau der Fall, für den das Band da ist. Der Wert liegt 0,8 Prozent darunter, was eine Prozentanzeige wegrunden würde.',
      },
      {
        label: 'Kapazitätserhalt nach 1000 Zyklen',
        value: 88.3,
        lowerLimit: 80,
        upperLimit: 100,
        target: 90,
        unit: '%',
        note: 'Achtzig Prozent nach tausend Zyklen ist eine übliche Lebensdauergrenze für Automobilzellen. Darüber ist bestanden — und wie weit darüber, ist die Reserve.',
      },
    ],

    readingTitle: 'Wie ein Messwert dargestellt wird',
    readingBody:
      'Das Toleranzband ist das Element, an das man sich bei diesem Produkt erinnert, und es erscheint überall dort, wo ein echter Messwert auf eine echte Grenze trifft — sonst nirgends. Seine Bedeutung liegt in der Position, was zugleich die ehrliche Antwort auf Diagramme ist, die für farbfehlsichtige Leser versagen.',
    readingPoints: [
      'Das Toleranzfenster ist als gefüllter Abschnitt gezeichnet, der Messwert als Marke davor. Die Bedeutung liegt in der Position — der Wert bleibt in Graustufen, am Beamer und auf dem Ausdruck lesbar.',
      'Farbe ist ein zweites Signal, nie das einzige. Die Statusangaben — in der Spezifikation, nahe der Grenze, außerhalb — werden ausgesprochen und nicht über einen Farbton angedeutet.',
      'Hinter jedem Diagramm liegt eine Datentabelle, ausklappbar statt versteckt, damit ein Screenreader die Zahlen bekommt und nicht die Beschreibung eines Bildes.',
      'Zahlen sind in Tabellenziffern gesetzt, damit ein Wert zwischen zwei Messungen nicht seitlich springt.',
    ],

    honestTitle: 'Was es noch nicht gibt',
    honestBody:
      'Es gibt keine Live-Anbindung an eine Linie, keine Alarmierung und keine werksübergreifende Verdichtung. Das Dashboard läuft auf einer eingespielten Pilotlinie, und die Zahlen auf dieser Website sind deren Zahlen. Wenn diese Funktionen kommen, werden sie genauso beschrieben: was sie tun, auf welchen Daten, mit welchen Grenzen.',
  },
};
