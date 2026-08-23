// @ts-check
const nextjsConfig = require('@fumibug/config/eslint/nextjs');

module.exports = [
  ...nextjsConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  },
];
