import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SpecBand } from './SpecBand.js';

/** Porosity after calendering runs 30–35% — see CONTEXT.md. */
const POROSITY = {
  label: 'Electrode porosity',
  lowerLimit: 30,
  upperLimit: 35,
  unit: '%',
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
