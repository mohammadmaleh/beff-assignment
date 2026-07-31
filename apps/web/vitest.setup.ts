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
