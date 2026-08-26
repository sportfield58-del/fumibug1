// @ts-check
const nestjsConfig = require('@fumibug/config/eslint/nestjs');

module.exports = [
  ...nestjsConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    // test/: supertest tipa `.body` como `any` y Nest tipa `getHttpServer()` de forma
    // laxa — es el patrón estándar de e2e con Nest+supertest, no código de aplicación.
    // Ver el mismo criterio en packages/contracts/eslint.config.js (scripts/).
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
];
