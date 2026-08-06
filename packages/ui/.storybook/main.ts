import tailwindcss from '@tailwindcss/vite';

import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook for the design system, and only for the design system.
 *
 * `apps/web`'s components are deliberately absent. Every one of them takes a
 * `Locale` and reads a dictionary, or sits behind React Query and an auth
 * provider - mounting those here would mean a fixture app, and a fixture app is
 * a second implementation of the product that goes stale silently. What belongs
 * in a component explorer is the layer that has no idea what a battery cell is,
 * which is exactly the boundary the package split already draws.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-docs',
    // Not optional here. This project targets WCAG 2.2 AA and gates it in CI,
    // and a component explorer is the one place a state that never appears in
    // a page - a disabled button, an error field, a loading table - can be
    // checked at all. axe covers 30–50%; this is that 30–50% at the unit level.
    '@storybook/addon-a11y',
  ],
  framework: { name: '@storybook/react-vite', options: {} },
  core: {
    /*
     * Off, and for the same reason the typefaces are self-hosted rather than
     * pulled from the Google CDN: a product whose pitch includes GDPR
     * competence does not ship a build step that phones a third party by
     * default. It is anonymous and it is opt-out - neither of which is the
     * point when the argument being made is about defaults.
     */
    disableTelemetry: true,
  },
  viteFinal(viteConfig) {
    /*
     * Tailwind v4 is a Vite plugin, not a PostCSS config - `preview.css`
     * carries the `@import 'tailwindcss'` and the plugin compiles it. Without
     * this every story renders with correct markup and no styling, which looks
     * like a broken component rather than a missing build step.
     */
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
    return viteConfig;
  },
};

export default config;
