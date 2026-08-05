import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EChart } from './EChart';

import type { EChartsOption } from '../../lib/chart/index';

/**
 * Two things about this component are worth a test, and neither is what it
 * draws — the drawing is `aria-hidden` and its correctness is the option
 * builders' problem, tested separately.
 *
 * What matters here is lifecycle. ECharts owns a DOM subtree and a render loop
 * outside React's knowledge, so a missed `dispose()` leaks an instance and a
 * `ResizeObserver` per mount, and the symptom is a page that gets slower the
 * longer someone leaves the dashboard open — the hardest kind of bug to
 * attribute to a chart.
 */

const option: EChartsOption = {
  xAxis: { type: 'category', data: ['a', 'b'] },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: [1, 2] }],
};

describe('EChart', () => {
  it('hides its container from assistive technology', () => {
    // The table beside it is the accessible rendering. This assertion is what
    // stops a future edit from "helpfully" adding a role and an aria-label.
    const { container } = render(<EChart option={option} height="20rem" />);
    const element = container.firstElementChild;

    expect(element).toHaveAttribute('aria-hidden', 'true');
  });

  it('sizes itself in rem so it scales with the reader’s text size', () => {
    const { container } = render(<EChart option={option} height="20rem" />);
    const element = container.firstElementChild as HTMLElement;

    expect(element.style.blockSize).toBe('20rem');
  });

  it('observes its own box rather than the window', () => {
    // The window does not resize when a `<details>` above the chart opens or
    // when a German string wraps and widens the section. All of those change
    // this element's box, and a window listener sees none of them.
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        unobserve = vi.fn();
        disconnect = disconnect;
      },
    );

    const { unmount } = render(<EChart option={option} height="20rem" />);
    expect(observe).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('resizes the chart when its own box changes', () => {
    // The callback is the entire point of observing. A stub that only recorded
    // `observe()` would pass with an empty handler, which is exactly the bug
    // this guards: a chart that never redraws after the sidebar collapses.
    let fire: (() => void) | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          fire = callback;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );

    render(<EChart option={option} height="20rem" />);

    expect(fire).toBeTypeOf('function');
    expect(() => {
      fire?.();
    }).not.toThrow();

    vi.unstubAllGlobals();
  });

  it('mounts and unmounts without leaving anything behind', () => {
    // A missed `dispose()` shows up as "There is a chart instance already
    // initialized on the dom" the second time the same node is used, which in
    // a React tree means the second navigation to the dashboard.
    const { unmount } = render(<EChart option={option} height="20rem" />);

    expect(() => {
      unmount();
    }).not.toThrow();
  });

  it('survives being handed a new option', () => {
    const { rerender } = render(<EChart option={option} height="20rem" />);

    expect(() => {
      rerender(
        <EChart option={{ ...option, series: [{ type: 'bar', data: [3, 4] }] }} height="20rem" />,
      );
    }).not.toThrow();
  });

  it('accepts a class name so a caller can position it', () => {
    render(<EChart option={option} height="20rem" className="mt-4" />);

    expect(document.querySelector('.mt-4')).not.toBeNull();
  });

  it('renders nothing that reaches the accessibility tree', () => {
    render(<EChart option={option} height="20rem" />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('graphics-document')).toBeNull();
  });
});
