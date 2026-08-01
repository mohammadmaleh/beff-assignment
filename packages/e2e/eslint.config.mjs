import baseConfig from '@beff/config/eslint';

export default [...baseConfig, { ignores: ['playwright-report/**', 'test-results/**'] }];
