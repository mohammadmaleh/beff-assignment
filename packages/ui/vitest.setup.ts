import '@testing-library/jest-dom/vitest';

// The jsdom gaps both suites share — matchMedia, ResizeObserver, canvas text
// metrics and a working Storage. One copy, in @beff/config.
import '@beff/config/vitest-shims';
