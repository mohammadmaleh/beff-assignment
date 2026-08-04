import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SpecBand, type SpecBandWords } from './SpecBand';

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
    const { container } = render(<SpecBand {...POROSITY} value={32.4} />);
    expect(container.querySelector('[aria-hidden="true"].relative')).toBeInTheDocument();
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

  it('states the specification once, not once per rendering of it', () => {
    // The axis, the drawing and the readout sentence all know the window. Two
    // of them printing it is a figure the reader has to reconcile with itself.
    render(<SpecBand {...POROSITY} value={32.4} scale="hero" />);
    const occurrences = (screen.getByRole('figure').textContent ?? '').match(
      /Specification 30\.0–35\.0/g,
    );
    expect(occurrences).toHaveLength(1);
  });

  it('labels the parts of the drawing so a page can animate them', () => {
    // The keyframes live in the app, not here: a library that animates on mount
    // animates in every context it is placed in, twelve at a time included.
    // These attributes are the contract that makes that possible, so they are
    // asserted rather than left as an implementation detail.
    const { container } = render(<SpecBand {...POROSITY} value={37.2} target={32.5} />);
    expect(container.querySelector('[data-part="range"]')).toBeInTheDocument();
    expect(container.querySelector('[data-part="tick"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-part="limit"]')).toHaveLength(3);
  });

  it('does not draw outside the track when the reading is wildly out', () => {
    // Clamped for the drawing only — the text readout still carries the true
    // number, which is the one a reviewer would check.
    render(<SpecBand {...POROSITY} value={900} />);
    expect(screen.getByRole('figure')).toHaveTextContent('900.0 %');
    const marks = screen
      .getByRole('figure')
      .querySelectorAll<HTMLElement>('[style*="inset-inline-start"]');
    for (const mark of marks) {
      const pct = Number.parseFloat(mark.style.insetInlineStart);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });
});
