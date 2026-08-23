// @ts-check
const baseConfig = require('@fumibug/config/eslint/base');

module.exports = [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  },
];
