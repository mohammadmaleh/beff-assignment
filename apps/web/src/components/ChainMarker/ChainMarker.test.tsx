import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PROCESS_STEPS } from '@/lib/metrics';

import { ChainMarker } from './ChainMarker';

describe('ChainMarker', () => {
  it('numbers the step from the canonical order, not by hand', () => {
    // The whole justification for `01`–`12` on a marketing page is that this is
    // a real typed sequence. A hand-written ordinal that disagrees with
    // PROCESS_STEPS turns the earned numbering back into decoration.
    const { container } = render(<ChainMarker step="formation" locale="en" />);

    expect(PROCESS_STEPS.indexOf('formation')).toBe(9);
    expect(container.textContent).toContain('10');
  });

  it('pads to two digits, so the markers form a column', () => {
    const { container } = render(<ChainMarker step="mixing" locale="en" />);
    expect(container.textContent).toContain('01');
  });

  it('names the step with the product’s own dictionary', () => {
    // Same strings the dashboard labels its chart with. If the marketing page
    // kept its own copy, the two surfaces could name one step differently.
    const { container } = render(<ChainMarker step="eol_test" locale="en" />);
    expect(container.textContent).toContain('End-of-line test');
  });

  it('names it in German on the German page', () => {
    const { container } = render(<ChainMarker step="eol_test" locale="de" />);
    expect(container.textContent).toContain('Endprüfung');
    expect(container.textContent).not.toContain('End-of-line');
  });

  it('is hidden from assistive technology', () => {
    /*
     * Deliberate, and the one judgement call in this component. The marker
     * carries real information — where in the chain this section sits — but the
     * heading immediately after states the section's subject in words, so
     * announcing "10 Formation" first would put a bare ordinal in the rotor
     * ahead of every heading. The chain is stated in words by the cost figure's
     * description, which is not hidden.
     */
    const { container } = render(<ChainMarker step="coating" locale="en" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
