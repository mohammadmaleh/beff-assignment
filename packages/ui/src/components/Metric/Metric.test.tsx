import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Metric } from './Metric.js';

describe('Metric', () => {
  it('renders the figure with its label and unit', () => {
    // First-pass yield on a pilot line runs 40–80% — see CONTEXT.md.
    render(<Metric label="First-pass yield" value="72.4" unit="%" />);
    expect(screen.getByText('First-pass yield')).toBeInTheDocument();
    expect(screen.getByText('72.4')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('holds the figure to tabular numerals, so a column of them cannot jitter', () => {
    render(<Metric label="First-pass yield" value="72.4" />);
    expect(screen.getByText('72.4')).toHaveClass('tabular-nums');
  });

  it.each([
    ['up', 'up'],
    ['down', 'down'],
    ['flat', 'unchanged'],
  ] as const)('spells the %s trend out for a screen reader', (trend, word) => {
    render(<Metric label="First-pass yield" value="72.4" delta="+1.4 pp" trend={trend} />);
    expect(screen.getByText(word, { exact: false })).toBeInTheDocument();
  });

  it('leaves the delta neutral when no intent is given', () => {
    // Yield rising is good news; scrap rising is not. The same arrow has to
    // mean opposite things in two tiles, so the component refuses to guess.
    render(<Metric label="Scrap rate" value="4.1" delta="+0.3 pp" trend="up" />);
    expect(screen.getByText('+0.3 pp').parentElement).toHaveClass('text-text-muted');
  });

  it('colours the delta by intent rather than by direction', () => {
    render(<Metric label="Scrap rate" value="4.1" delta="+0.3 pp" trend="up" intent="negative" />);
    expect(screen.getByText('+0.3 pp').parentElement).toHaveClass('text-status-danger-fg');
  });

  it('omits the delta entirely when there is none', () => {
    render(<Metric label="First-pass yield" value="72.4" />);
    expect(screen.queryByText(/pp/)).not.toBeInTheDocument();
  });
});
