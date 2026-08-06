import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The key is the caller's - that is the whole point of the prop. Using a test
 * key rather than importing the app's is also what proves the component reads
 * the one it was given rather than a constant it happens to close over.
 */
const STORAGE_KEY = 'test-theme';

const LABELS = { toDark: 'Switch to dark appearance', toLight: 'Switch to light appearance' };
const LABELS_DE = {
  toDark: 'Zu dunkler Darstellung wechseln',
  toLight: 'Zu heller Darstellung wechseln',
};

import { ThemeToggle } from './ThemeToggle';

/**
 * `window.localStorage`, never the bare global. Node 25 defines `localStorage`
 * on `globalThis`, and in vitest's jsdom environment `window === globalThis`, so
 * Node's inert version shadows jsdom's - the bare form fails with
 * "localStorage.clear is not a function" in a test that works in a browser.
 *
 * `matchMedia` is the same story one level worse: jsdom does not implement it at
 * all. `vitest.setup.ts` installs a never-matching default; the tests below that
 * care about the OS preference stub their own.
 */

/** A `matchMedia` whose result can be flipped, so an OS change is testable. */
function stubPrefersDark(matches: boolean): (next: boolean) => void {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let current = matches;

  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return current;
    },
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

  // `act`, because the OS changing its mind is a React state update that
  // originates outside React. Without it the assertion reads the pre-update
  // render and the failure looks like the component ignored the event.
  return (next: boolean) => {
    current = next;
    act(() => {
      for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent);
    });
  };
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a plain button, so it needs no ARIA to be operable', () => {
    stubPrefersDark(false);
    render(<ThemeToggle labels={LABELS} storageKey={STORAGE_KEY} />);
    expect(screen.getByRole('button').tagName).toBe('BUTTON');
  });

  it('is named for the action it performs, not for the setting it holds', () => {
    stubPrefersDark(false);
    render(<ThemeToggle labels={LABELS} storageKey={STORAGE_KEY} />);
    // "Appearance" names a preference and leaves the reader to infer the effect.
    // A button announces what pressing it does.
    expect(screen.getByRole('button', { name: /switch to dark/i })).toBeInTheDocument();
  });

  it('adopts the system preference with no choice stored', () => {
    stubPrefersDark(true);
    render(<ThemeToggle labels={LABELS} storageKey={STORAGE_KEY} />);
    // The OS says dark, so the only thing left to offer is light.
    expect(screen.getByRole('button', { name: /switch to light/i })).toBeInTheDocument();
  });

  it('does not pin anything until the reader actually chooses', () => {
    stubPrefersDark(true);
    render(<ThemeToggle labels={LABELS} storageKey={STORAGE_KEY} />);
    // Reading the system preference must not *write* it. Pinning on load would
    // freeze the visitor into whatever their OS said the first time they came,
    // and the page would stop following them ever after.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('keeps following the system while nothing is pinned', () => {
    const setPrefersDark = stubPrefersDark(false);
    render(<ThemeToggle labels={LABELS} storageKey={STORAGE_KEY} />);
    expect(screen.getByRole('button', { name: /switch to dark/i })).toBeInTheDocument();

    setPrefersDark(true);

    // The media query drives the page here, so a control claiming otherwise
    // would be lying about what the reader is looking at.
    expect(screen.getByRole('button', { name: /switch to light/i })).toBeInTheDocument();
  });

  it('pins the opposite theme and remembers it', async () => {
    stubPrefersDark(false);
    render(<ThemeToggle labels={LABELS} storageKey={STORAGE_KEY} />);

    await userEvent.click(screen.getByRole('button'));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: /switch to light/i })).toBeInTheDocument();
  });

  it('stops following the system once a choice is pinned', async () => {
    const setPrefersDark = stubPrefersDark(false);
    render(<ThemeToggle labels={LABELS} storageKey={STORAGE_KEY} />);

    await userEvent.click(screen.getByRole('button'));
    setPrefersDark(true);

    // An explicit choice outranks the OS. Otherwise the reader's decision would
    // be silently overwritten the next time their machine switched at sunset.
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: /switch to light/i })).toBeInTheDocument();
  });

  it('reads the pinned choice after mount, over the system preference', () => {
    stubPrefersDark(true);
    window.localStorage.setItem(STORAGE_KEY, 'light');
    render(<ThemeToggle labels={LABELS} storageKey={STORAGE_KEY} />);
    expect(screen.getByRole('button', { name: /switch to dark/i })).toBeInTheDocument();
  });

  it('toggles back, and back again', async () => {
    stubPrefersDark(false);
    render(<ThemeToggle labels={LABELS} storageKey={STORAGE_KEY} />);

    await userEvent.click(screen.getByRole('button'));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');

    await userEvent.click(screen.getByRole('button'));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('is named in whatever language the caller hands it', () => {
    stubPrefersDark(false);
    render(<ThemeToggle labels={LABELS_DE} storageKey={STORAGE_KEY} />);
    expect(screen.getByRole('button', { name: /dunkler darstellung/i })).toBeInTheDocument();
  });

  it('carries no visible label text, only the icon and its accessible name', () => {
    stubPrefersDark(false);
    render(<ThemeToggle labels={LABELS} storageKey={STORAGE_KEY} />);
    // The header is four items wide at 320px. "Appearance" plus a select ate a
    // third of it to say something the icon says in 20 pixels.
    expect(screen.getByRole('button').textContent).toBe('');
  });
});
