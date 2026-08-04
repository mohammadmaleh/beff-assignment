import '@testing-library/jest-dom/vitest';

/**
 * Restore a working `localStorage`.
 *
 * Node 25 defines `localStorage` on `globalThis` by default. In vitest's jsdom
 * environment `window === globalThis`, so Node's definition shadows jsdom's —
 * and Node's is inert unless the process was started with `--localstorage-file`,
 * which makes every call fail with "localStorage.clear is not a function".
 *
 * The symptom is nasty: code that works perfectly in a browser fails only under
 * test, and the error names a method rather than the storage object, so it reads
 * like a typo. Writing `window.localStorage` instead of the bare global does not
 * help, because here they are the same object.
 *
 * This installs a plain in-memory `Storage` when the ambient one cannot store
 * anything. It is not a general polyfill — it exists so the tests exercise the
 * same code path the browser will.
 */
function installStorage(name: 'localStorage' | 'sessionStorage'): void {
  const existing: unknown = Reflect.get(globalThis, name);
  const works =
    typeof existing === 'object' &&
    existing !== null &&
    typeof (existing as Storage).clear === 'function';
  if (works) return;

  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return entries.size;
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, String(value));
    },
    removeItem: (key) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
  };

  Object.defineProperty(globalThis, name, {
    value: storage,
    configurable: true,
    writable: true,
  });
}

installStorage('localStorage');
installStorage('sessionStorage');

/**
 * Install a `matchMedia` that is merely absent rather than broken.
 *
 * jsdom has never implemented `window.matchMedia` — it is one of its documented
 * omissions, not a version gap — so any component that resolves the user's
 * colour-scheme preference throws `matchMedia is not a function` under test
 * while working everywhere else. Same shape as the `localStorage` trap above:
 * the failure names a method, so it reads like a typo in the component.
 *
 * This default never matches, which makes "light" the ambient preference for
 * every test that does not care. A test that *does* care stubs `matchMedia`
 * itself with `vi.stubGlobal`, so the control stays next to the assertion
 * rather than in a file nobody opens.
 */
function installMatchMedia(): void {
  if (typeof globalThis.matchMedia === 'function') return;

  Object.defineProperty(globalThis, 'matchMedia', {
    value: (query: string): MediaQueryList => {
      const listeners = new Set<EventListenerOrEventListenerObject>();
      const list: MediaQueryList = {
        media: query,
        matches: false,
        onchange: null,
        // Annotated rather than inferred: `addEventListener` is overloaded on
        // `MediaQueryList`, and an overloaded signature supplies no contextual
        // type to an object literal implementing it.
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
          listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => true,
        // Deprecated, but React and several libraries still feature-detect them.
        addListener: () => {},
        removeListener: () => {},
      };
      return list;
    },
    configurable: true,
    writable: true,
  });
}

installMatchMedia();
