// @ts-check
const base = require('./base');

/**
 * Preset para apps/web. Agrega las reglas de frontera de docs/spec/16-estructura.md:
 * "apps/web no importa de apps/api ni de packages/db" y "ninguna app importa Prisma
 * directamente salvo apps/api".
 */
module.exports = [
  ...base,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/api/**', '@fumibug/db', '@fumibug/db/*', '@prisma/client'],
              message:
                'apps/web no puede importar de apps/api, packages/db ni Prisma directamente (docs/spec/16-estructura.md, regla de dependencias).',
            },
          ],
        },
      ],
    },
  },
];
