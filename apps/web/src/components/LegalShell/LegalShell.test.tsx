import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LegalSection, LegalShell } from './LegalShell';

describe('LegalShell', () => {
  it('gives the document a single top-level heading', () => {
    render(
      <LegalShell locale="en" lang="en" title="Imprint" note="Under §5 DDG.">
        <p>body</p>
      </LegalShell>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Imprint' })).toBeInTheDocument();
  });

  it('marks the body’s language independently of the page locale', () => {
    // The Impressum is German on the English page. §5 DDG content is German or
    // it is not the disclosure, and an English voice reading it is WCAG 3.1.2.
    const { container } = render(
      <LegalShell locale="en" lang="de" title="Imprint" note="Under §5 DDG.">
        <p>Angaben gemäß §5 DDG</p>
      </LegalShell>,
    );
    expect(container.querySelector('[lang="de"]')).toHaveTextContent('Angaben gemäß §5 DDG');
  });

  it('hyphenates, because German compounds overflow a prose measure', () => {
    const { container } = render(
      <LegalShell locale="de" lang="de" title="Impressum" note="Nach §5 DDG.">
        <p>Datenschutz-Grundverordnung</p>
      </LegalShell>,
    );
    // CSS hyphenation only engages when the language is declared, so the two
    // belong together or neither does anything.
    expect(container.querySelector('[lang="de"]')?.className).toContain('[hyphens:auto]');
  });

  it('gives every section an anchor a deep link can reach', () => {
    const { container } = render(
      <LegalShell locale="en" lang="en" title="Terms" note="note">
        <LegalSection id="liability" heading="Liability">
          <p>body</p>
        </LegalSection>
      </LegalShell>,
    );
    const section = container.querySelector('#liability');
    expect(section).toBeInTheDocument();
    // Without scroll-margin the linked heading lands under the sticky header and
    // the reader sees the paragraph *after* the one they asked for.
    expect(section?.className).toContain('scroll-mt-8');
    expect(screen.getByRole('heading', { level: 2, name: 'Liability' })).toBeInTheDocument();
  });
});
