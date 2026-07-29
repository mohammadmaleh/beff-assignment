// Shared flat config. Apps extend this and add framework-specific rules.
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/storybook-static/**',
      '**/coverage/**',
      // ESLint's own config is not part of any tsconfig project, so the
      // type-aware parser cannot resolve it. Linting it adds nothing.
      '**/eslint.config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    ...jsxA11y.flatConfigs.strict,
    rules: {
      // Must live in the same config object that registers the plugin — flat
      // config scopes plugins per-object, so rules declared elsewhere fail with
      // "could not find plugin".
      ...jsxA11y.flatConfigs.strict.rules,

      // Accessibility is a CI gate, so a11y problems are errors, not warnings.
      // See docs/design/accessibility.md for the audit process.
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
    },
  },
  {
    rules: {
      // Unused args are fine when prefixed — common in event handlers and
      // deliberately-ignored callback params.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Floating promises are a real bug source in React effects and route
      // handlers; surface them rather than letting them fail silently.
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    // Framework config files declare async signatures the framework requires
    // (Next's `headers()` must return a Promise), so require-await fires on
    // correct code.
    files: ['**/*.config.{ts,mts,js,mjs}'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
);
