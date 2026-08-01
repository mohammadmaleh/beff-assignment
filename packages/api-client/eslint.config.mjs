import baseConfig from '@beff/config/eslint';

export default [
  ...baseConfig,
  {
    // Generated wholesale by `openapi-typescript`; editing it is what the drift
    // check exists to prevent, so linting it would only produce noise nobody is
    // allowed to fix.
    ignores: ['src/schema.d.ts', 'scripts/**'],
  },
];
