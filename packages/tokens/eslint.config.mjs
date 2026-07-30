import baseConfig from '@beff/config/eslint';

export default [...baseConfig, { ignores: ['dist/**', 'build.js'] }];
