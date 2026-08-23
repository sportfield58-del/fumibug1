// @ts-check
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');

/**
 * Config base compartida por todo el monorepo. Cada app/paquete la extiende y agrega
 * su propia regla de fronteras (ver ./nestjs.js, ./nextjs.js, ./contracts.js) y su propio
 * tsconfig vía parserOptions.project en el eslint.config.js consumidor.
 *
 * Propiedad: humano (packages/config/** — ver CLAUDE.md §3).
 */
module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    rules: {
      // Prohibido `any` — CLAUDE.md §5 ("Backend/Prohibido")
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // Prohibido console.* — usar logger estructurado. CLAUDE.md §5.
      'no-console': 'error',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.cjs',
    ],
  },
);
