import { useEffect } from 'react';

import './preview.css';

import type { Preview } from '@storybook/react-vite';

/**
 * The theme is a toolbar control rather than a per-story decision.
 *
 * This palette is solved twice - every pair in it is asserted against WCAG in
 * both themes by the contrast gate in `packages/tokens` - and the dark theme is
 * not a filter over the light one. A component explorer that only ever shows
 * one of them documents half the system, and it is the half nobody reports bugs
 * against because they cannot see it.
 *
 * Written to `<html>`, not to a wrapper, because that is where the token sheet
 * keys off it: `[data-theme]` with a `prefers-color-scheme` fallback for the
 * reader who never chose. Setting it on a wrapper div would work for colours
 * and silently not work for `body`, which is what the canvas actually paints.
 */
function useTheme(theme: string): void {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    return () => {
      root.removeAttribute('data-theme');
    };
  }, [theme]);
}

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: {
      // Report, do not fail the render. A story whose *point* is an
      // intermediate state should still be inspectable - the gate that blocks
      // merges is `packages/e2e`, which walks the real accessibility tree.
      test: 'todo',
    },
    docs: { toc: true },
    backgrounds: {
      // Disabled deliberately. The surface is a token and it follows the theme;
      // a second, independent background switcher would let a reviewer put a
      // component on a colour the contrast gate has never solved and conclude
      // the palette is fine.
      disable: true,
    },
  },
  globalTypes: {
    theme: {
      description: 'Palette',
      toolbar: {
        title: 'Theme',
        icon: 'contrast',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    function ThemeDecorator(Story, context) {
      useTheme(String(context.globals.theme ?? 'light'));
      return <Story />;
    },
  ],
};

export default preview;
