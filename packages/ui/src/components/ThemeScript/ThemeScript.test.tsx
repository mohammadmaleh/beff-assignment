import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/** The caller's key, not the app's - the component takes it as a prop. */
const STORAGE_KEY = 'test-theme';

import { ThemeScript } from './ThemeScript';

/**
 * Run the emitted script the way the browser does.
 *
 * The whole point of this component is that its body executes *before* React
 * exists, so rendering it proves nothing on its own - the assertion has to be
 * about what the string does when evaluated.
 */
const runEmittedScript = (): void => {
  const { container } = render(<ThemeScript storageKey={STORAGE_KEY} />);
  const source = container.querySelector('script')?.innerHTML ?? '';
  expect(source).not.toBe('');
  // `new Function` rather than appending a real `<script>`: jsdom does not
  // execute injected scripts, so the element route would assert nothing. The
  // cast is what the constructor cannot know - this source takes no arguments
  // and returns nothing.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function(source) as () => void;
  run();
};

describe('ThemeScript', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies a stored dark choice', () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark');
    runEmittedScript();

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('leaves the attribute off when the reader follows their system', () => {
    // The token sheet's `:root:not([data-theme="light"])` media block already
    // handles no-preference. Writing "light" here would pin a dark-mode user to
    // light on their first visit.
    runEmittedScript();

    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('ignores a value that is not a theme', () => {
    window.localStorage.setItem(STORAGE_KEY, 'midnight');
    runEmittedScript();

    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('does not throw when storage is unavailable', () => {
    // Safari in private mode and a blocked-cookies profile both make
    // `localStorage` throw on access. This script blocks first paint, so an
    // uncaught error here is a blank page, not a wrong colour.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });

    try {
      expect(() => {
        runEmittedScript();
      }).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });

  it('escapes the storage key rather than interpolating it raw', () => {
    // The key is now a *prop*, and this string is injected with
    // `dangerouslySetInnerHTML` - so the quoting has to come from
    // `JSON.stringify` rather than from interpolation. A key containing a quote
    // would otherwise close the literal and the script would stop parsing,
    // which is the one place in this package where a prop reaches something
    // evaluated as code.
    const { container } = render(<ThemeScript storageKey={STORAGE_KEY} />);

    expect(container.querySelector('script')?.innerHTML).toContain(JSON.stringify(STORAGE_KEY));
  });
});
