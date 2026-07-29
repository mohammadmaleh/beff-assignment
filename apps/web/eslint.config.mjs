import baseConfig from '@beff/config/eslint';

export default [
  ...baseConfig,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];
