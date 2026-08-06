import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpecBand, type SpecBandWords } from './SpecBand';

import type { EChartsOption } from '../../lib/chart/index';

/**
 * Every option `SpecBand` has handed to `EChart`, newest last.
 *
 * The drawing is an ECharts instance, and in jsdom that instance lays out at
 * 0×0 — so the parts of this component that are *drawn* cannot honestly be
 * asserted against the DOM. They are asserted against the option instead, which
 * is a plain value and is the thing the component actually produces. What the
 * band draws from that option is `band.test.ts`'s subject.
 */
const options: EChartsOption[] = [];

vi.mock('../EChart/index', () => ({
  EChart: ({ option }: { option: EChartsOption }) => {
    options.push(option);
    return <div aria-hidden="true" data-testid="band-drawing" />;
  },
}));

function lastOption(): EChartsOption {
  const option = options.at(-1);
  if (option === undefined) throw new Error('SpecBand rendered no chart');
  return option;
}

/** The band's thickness, which is where the two scales visibly differ. */
function trackWidth(option: EChartsOption): number {
  const series = (option.series as { markLine?: { data?: unknown[] } }[])[0];
  const [track] = (series?.markLine?.data ?? []) as [{ lineStyle?: { width?: number } }][];
  return track?.[0].lineStyle?.width ?? 0;
}

beforeEach(() => {
  options.length = 0;
});

const WORDS: SpecBandWords = {
  inSpec: 'in spec',
  aboveUpper: 'out of spec, above the upper limit',
  belowLower: 'out of spec, below the lower limit',
  specification: 'Specification',
  target: 'target',
};

/** Porosity after calendering runs 30–35% — see CONTEXT.md. */
const POROSITY = {
  label: 'Electrode porosity',
  lowerLimit: 30,
  upperLimit: 35,
  unit: '%',
  words: WORDS,
} as const;

describe('SpecBand', () => {
  it('states the verdict in words, not only by position', () => {
    render(<SpecBand {...POROSITY} value={32.4} />);
    expect(screen.getByText(/in spec/)).toBeInTheDocument();
  });

  it('says which limit was breached when the reading is high', () => {
    render(<SpecBand {...POROSITY} value={37.2} />);
    expect(screen.getByText(/out of spec, above the upper limit/)).toBeInTheDocument();
  });

  it('says which limit was breached when the reading is low', () => {
    render(<SpecBand {...POROSITY} value={27.9} />);
    expect(screen.getByText(/out of spec, below the lower limit/)).toBeInTheDocument();
  });

  it('treats the limits themselves as in spec', () => {
    render(<SpecBand {...POROSITY} value={30} />);
    expect(screen.getByText(/in spec/)).toBeInTheDocument();
  });

  it('reports the specification window and the target in the text alternative', () => {
    render(<SpecBand {...POROSITY} value={32.4} target={32.5} />);
    expect(screen.getByText(/Specification 30\.0–35\.0 %/)).toBeInTheDocument();
    expect(screen.getByText(/target 32\.5 %/)).toBeInTheDocument();
  });

  it('hides the drawing from assistive technology — the readout carries the meaning', () => {
    // The band is an ECharts instance now, and `EChart` hides its own container.
    // The assertion is that *something* is drawn and that it is hidden: an
    // exposed ECharts SVG is a run of loose `<text>` nodes read in visual order
    // with no structure.
    render(<SpecBand {...POROSITY} value={32.4} />);

    expect(screen.getByTestId('band-drawing')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is a figure with a caption, so the label travels with the graphic', () => {
    render(<SpecBand {...POROSITY} value={32.4} />);
    expect(screen.getByRole('figure')).toHaveTextContent('Electrode porosity');
  });

  it('builds the whole readout from the caller’s words, with no English left in it', () => {
    // The regression test for the finding that produced this API. `SpecBand`
    // used to compose its readout from English literals, so the German landing
    // page announced the product's signature element as "32.4 % — in spec.
    // Specification 30.0–35.0 %, target 32.5 %" inside a `lang="de"` document —
    // a WCAG 3.1.2 failure that no visual check and no axe rule could see.
    render(
      <SpecBand
        {...POROSITY}
        value={36.8}
        target={32.5}
        words={{
          inSpec: 'in der Spezifikation',
          aboveUpper: 'außerhalb der Spezifikation, über der oberen Grenze',
          belowLower: 'außerhalb der Spezifikation, unter der unteren Grenze',
          specification: 'Spezifikation',
          target: 'Ziel',
        }}
      />,
    );

    const readout = screen.getByRole('figure').textContent ?? '';
    expect(readout).toContain('außerhalb der Spezifikation, über der oberen Grenze');
    expect(readout).toContain('Spezifikation 30.0–35.0 %');
    expect(readout).toContain('Ziel 32.5 %');
    for (const english of ['in spec', 'out of spec', 'Specification', 'target']) {
      expect(readout).not.toContain(english);
    }
  });

  it('labels the plotted domain at hero scale and nowhere else', () => {
    // The default band stacks twelve deep on the dashboard, where axis numbers
    // are noise. Standing alone in a hero it is the difference between an axis
    // and a decorative line.
    const { rerender } = render(<SpecBand {...POROSITY} value={32.4} />);
    expect(screen.getByRole('figure').textContent).not.toContain('27.5 %');

    rerender(<SpecBand {...POROSITY} value={32.4} scale="hero" />);
    const readout = screen.getByRole('figure').textContent ?? '';
    // Domain defaults to the window padded by half its width: 30-2.5 to 35+2.5.
    expect(readout).toContain('27.5 %');
    expect(readout).toContain('37.5 %');
  });

  it('plots the domain it is given instead of padding the window', () => {
    /*
     * The default domain is the window padded by half its width, which keeps an
     * out-of-spec reading visible rather than clipped. It is the wrong choice
     * when the reading is far outside: the landing hero's 78.4 against an 85–97
     * window would pin against the axis, understating the figure the whole page
     * is built on. The `domain` prop is the escape hatch, and it is the one
     * `LandingHero` depends on.
     */
    render(<SpecBand {...POROSITY} value={32.4} scale="hero" domain={[0, 50]} />);

    const readout = screen.getByRole('figure').textContent ?? '';
    expect(readout).toContain('0.0 %');
    expect(readout).toContain('50.0 %');
    // The padded default, which must not survive an explicit domain.
    expect(readout).not.toContain('27.5 %');
  });

  it('reads cleanly when the measurement has no unit', () => {
    // Not every reading is a percentage — a count or a ratio has no unit, and a
    // component that assumed one would render "32.4 undefined" or leave a
    // trailing space before the em dash in the readout sentence.
    render(
      <SpecBand label="Cells per tray" words={WORDS} value={32} lowerLimit={30} upperLimit={35} />,
    );

    expect(screen.getByRole('figure')).toHaveTextContent(
      '32.0 — in spec. Specification 30.0–35.0.',
    );
  });

  it('states the specification once, not once per rendering of it', () => {
    // The axis, the drawing and the readout sentence all know the window. Two
    // of them printing it is a figure the reader has to reconcile with itself.
    render(<SpecBand {...POROSITY} value={32.4} scale="hero" />);
    const occurrences = (screen.getByRole('figure').textContent ?? '').match(
      /Specification 30\.0–35\.0/g,
    );
    expect(occurrences).toHaveLength(1);
  });

  it('states a wild reading in full, however the drawing has to compress it', () => {
    // `bandOption` clamps the mark to the plotted domain so a reading of 900
    // pins to the edge rather than being drawn off-plot — that clamping is
    // asserted on the option, in `band.test.ts`, where it is a value rather than
    // a rendered pixel. What this file owes is the other half of the bargain:
    // the number the reader is *told* is never the clamped one.
    render(<SpecBand {...POROSITY} value={900} />);

    expect(screen.getByRole('figure')).toHaveTextContent('900.0 %');
    expect(screen.getByText(/out of spec, above the upper limit/)).toBeInTheDocument();
  });

  it('does not animate unless the page asks it to', () => {
    /*
     * The rule the old `data-part` hooks enforced by living in the app's
     * stylesheet: `packages/ui` does not animate on mount, because four of these
     * sit in one dashboard panel. An ECharts instance is outside the cascade, so
     * the opt-in had to become a prop — and a prop with the wrong default would
     * be invisible in every screenshot and every axe run.
     *
     * Asserted on the option handed to `EChart` rather than on the DOM. The
     * animation is a property of that option and of nothing else; a test that
     * looked for a rendered element would pass identically either way, which is
     * the shape of gate this repo has been bitten by before.
     */
    const { rerender } = render(<SpecBand {...POROSITY} value={32.4} />);
    expect(lastOption().animation).toBe(false);

    rerender(<SpecBand {...POROSITY} value={32.4} animate />);
    expect(lastOption().animation).toBe(true);
  });

  it('draws the hero at the hero’s weight, not the dashboard’s', () => {
    // One component, two sizes — the signature element must not exist twice or
    // the two copies drift. The band's thickness is the visible half of that
    // claim and it lives in the option, so it is checked there.
    render(<SpecBand {...POROSITY} value={32.4} />);
    const standard = trackWidth(lastOption());

    render(<SpecBand {...POROSITY} value={32.4} scale="hero" />);
    expect(trackWidth(lastOption())).toBeGreaterThan(standard);
  });
});
