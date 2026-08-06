import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useReducedMotion } from './motion';

/**
 * A tiny hook with one genuinely important behaviour: it has to keep listening.
 *
 * CSS handles `prefers-reduced-motion` for everything the app draws itself.
 * ECharts runs its own render loop outside the cascade's reach, so this is the
 * only channel the preference has - and a hook that read the query once would
 * leave a reader who turns the setting on mid-session watching the animation
 * they just asked to stop.
 */

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
    addListener: () => {},
    removeListener: () => {},
  }));

  return {
    change(next: boolean) {
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useReducedMotion', () => {
  it('reports the preference the reader already has', () => {
    stubMatchMedia(true);

    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });

  it('reports false when nothing was asked for', () => {
    stubMatchMedia(false);

    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it('follows the preference when it changes mid-session', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());

    act(() => {
      media.change(true);
    });

    expect(result.current).toBe(true);
  });

  it('stops listening when the component goes away', () => {
    // A chart per dashboard visit, times a listener each, is a leak that only
    // shows up as a page that gets slower the longer it is left open.
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());

    expect(media.listenerCount).toBe(1);
    unmount();
    expect(media.listenerCount).toBe(0);
  });
});
