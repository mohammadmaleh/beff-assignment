import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Reading, ReadingList } from './Reading';

describe('ReadingList', () => {
  it('is a description list, so each label and figure are a pair', () => {
    const { container } = render(
      <ReadingList>
        <Reading label="Cells passed" value="18 240" />
      </ReadingList>,
    );
    expect(container.querySelector('dl')).not.toBeNull();
  });

  it('takes the caller’s layout without supplying one', () => {
    // How many columns a set of readings wants is the page's decision, not the
    // library's. A default grid here would be a guess that ships.
    const { container } = render(
      <ReadingList className="grid grid-cols-4">
        <Reading label="Cells passed" value="18 240" />
      </ReadingList>,
    );
    expect(container.querySelector('dl')?.className).toContain('grid-cols-4');
  });
});

describe('Reading', () => {
  it('pairs its label with its figure', () => {
    const { container } = render(
      <ReadingList>
        <Reading label="Cells passed" value="18 240" />
      </ReadingList>,
    );
    expect(container.querySelector('dt')?.textContent).toBe('Cells passed');
    expect(container.querySelector('dd')?.textContent).toContain('18 240');
  });

  it('sets the figure in tabular figures', () => {
    /*
     * Not decoration. Proportional digits shift the decimal point between
     * renders, and a figure that jitters as it updates is a figure an engineer
     * stops reading.
     */
    render(
      <ReadingList>
        <Reading label="Committed value lost" value="€47 200" />
      </ReadingList>,
    );
    expect(screen.getByText('€47 200').className).toContain('tabular-nums');
  });

  it('renders the note inside the same pair as the figure it qualifies', () => {
    /*
     * The note is what separates this from a bare number: "against a cohort
     * median of 74.1%" is the difference between a reading and a claim. It has
     * to sit inside the `dd`, or a screen reader walking the list announces it
     * against the *next* term.
     */
    const { container } = render(
      <ReadingList>
        <Reading label="Versus cohort" value="−2.3 pp" note="Median 74.1% across 24 lines" />
      </ReadingList>,
    );
    const dd = container.querySelector('dd');
    expect(dd?.textContent).toContain('−2.3 pp');
    expect(dd?.textContent).toContain('Median 74.1% across 24 lines');
    expect(container.querySelectorAll('dt')).toHaveLength(1);
  });

  it('omits the note entirely when there is none, rather than leaving an empty line', () => {
    const { container } = render(
      <ReadingList>
        <Reading label="Worst batch" value="—" />
      </ReadingList>,
    );
    // `> span` — a bare `span:last-child` matches any span that is last among
    // its own siblings, including one nested inside the figure.
    expect(container.querySelectorAll('dd > span')).toHaveLength(1);
  });

  it('says nothing about the language of what it is given', () => {
    // Every perceivable string is a required prop with no default. The library
    // cannot know the page's locale, so a default would be a guess that ships —
    // which is how the German landing page once announced itself in English.
    render(
      <ReadingList>
        <Reading label="Zugesagter Wert verloren" value="47 200 €" note="im Fenster" />
      </ReadingList>,
    );
    expect(screen.getByText('Zugesagter Wert verloren')).toBeInTheDocument();
    expect(screen.getByText('im Fenster')).toBeInTheDocument();
  });
});
