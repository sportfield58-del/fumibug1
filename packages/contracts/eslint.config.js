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
  {
    // scripts/ es un generador de CLI (pnpm generate), no runtime de la aplicación:
    // - console.* acá es la salida esperada para quien corre el comando, no un log de
    //   producción. La regla de no-console (CLAUDE.md §5) es sobre apps/api en runtime.
    // - any/unsafe-*: ENDPOINTS es un objeto `as const` con schemas de Zod anidados
    //   (ver el comentario en generate.ts) — iterar esa unión dispara "type
    //   instantiation excessively deep" en TS. `any` es el escape deliberado; la
    //   corrección de cada `example` ya la garantiza src/endpoints.spec.ts con los
    //   tipos completos, así que este archivo no repite esa garantía.
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
];
