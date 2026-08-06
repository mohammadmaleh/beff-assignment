import baseConfig from '@beff/config/eslint';

export default [
  ...baseConfig,
  {
    // postcss.config.mjs is not part of any tsconfig project, so the
    // type-aware parser cannot resolve it - same reason the shared config
    // already ignores eslint.config.mjs.
    ignores: ['.next/**', 'next-env.d.ts', 'postcss.config.mjs'],
  },
];
