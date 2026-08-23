// @ts-check
const contractsConfig = require('@fumibug/config/eslint/contracts');

module.exports = [
  ...contractsConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  },
];
