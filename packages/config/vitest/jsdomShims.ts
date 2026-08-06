/**
 * The jsdom gaps every suite in this repo has to fill.
 *
 * These are not per-app conveniences - they are all cases where jsdom does not
 * implement a browser API at all, so the *same* stub is correct in both suites.
 * They lived in `apps/web` while it was the only suite mounting a chart. The
 * chart layer now ships from `packages/ui`, so a copy in each package would be
 * two versions of one file, and the one that drifts is discovered by a test
 * that fails in a way that names a method rather than the gap.
 *
 * Imported for effect. Nothing here is exported.
 */

/**
 * Restore a working `localStorage`.
 *
 * Node 25 defines `localStorage` on `globalThis` by default. In vitest's jsdom
 * environment `window === globalThis`, so Node's definition shadows jsdom's -
 * and Node's is inert unless the process was started with `--localstorage-file`,
 * which makes every call fail with "localStorage.clear is not a function".
 *
 * The symptom is nasty: code that works perfectly in a browser fails only under
 * test, and the error names a method rather than the storage object, so it reads
 * like a typo. Writing `window.localStorage` instead of the bare global does not
 * help, because here they are the same object.
 *
 * This installs a plain in-memory `Storage` when the ambient one cannot store
 * anything. It is not a general polyfill - it exists so the tests exercise the
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
 * jsdom has never implemented `window.matchMedia` - it is one of its documented
 * omissions, not a version gap - so any component that resolves the user's
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

/**
 * Install a `ResizeObserver` that exists but never fires.
 *
 * jsdom does not implement it, for the honest reason that it does not do
 * layout - there is no box to observe, so every element measures 0×0 and a
 * faithful implementation would have nothing to report anyway.
 *
 * Absent, it is `ResizeObserver is not defined` thrown from inside an effect,
 * which vitest reports as an unhandled rejection: the run exits 1 while every
 * test still prints green. That is the failure mode this repo has already been
 * bitten by once, so the stub is here rather than in each chart's test.
 *
 * Deliberately inert. A stub that invoked its callback would have the chart
 * resize to 0×0 on mount and prove nothing except that the mock ran.
 */
function installResizeObserver(): void {
  if (typeof globalThis.ResizeObserver === 'function') return;

  class InertResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: InertResizeObserver,
    configurable: true,
    writable: true,
  });
}

installResizeObserver();

/**
 * Give ECharts something to measure text with.
 *
 * The SVG renderer draws no canvas, but ECharts still calls
 * `getContext('2d').measureText(…)` to lay out axis labels and legends - text
 * metrics are the one thing SVG cannot supply synchronously. jsdom does not
 * implement `getContext` without the native `canvas` package, so every chart
 * mounted in a test prints eleven "Not implemented" lines through jsdom's
 * virtual console.
 *
 * That is noise, not failure, and leaving it is worse than it sounds: a real
 * error in a chart test would be one line among sixty identical ones. So this
 * installs a context that measures, approximately, and does nothing else.
 *
 * The 0.6em-per-character estimate is deliberately crude. It is used only to
 * decide label spacing in a layout jsdom is not performing anyway; nothing
 * asserted in this repo depends on the number, and a stub that pretended to be
 * accurate would invite one that did.
 */
function installCanvasTextMetrics(): void {
  const prototype = globalThis.HTMLCanvasElement?.prototype;
  if (prototype === undefined) return;

  Object.defineProperty(prototype, 'getContext', {
    value(this: HTMLCanvasElement, kind: string) {
      if (kind !== '2d') return null;
      return {
        font: '',
        measureText: (text: string) => ({ width: text.length * 6 }),
        // ECharts probes for these before using the context; returning a bare
        // `measureText` makes it throw on the next property access instead.
        fillText: () => {},
        strokeText: () => {},
        save: () => {},
        restore: () => {},
        canvas: this,
      };
    },
    configurable: true,
    writable: true,
  });
}

installCanvasTextMetrics();
