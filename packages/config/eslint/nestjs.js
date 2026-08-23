// @ts-check
const base = require('./base');

/**
 * Preset para apps/api. Agrega la regla de frontera de docs/spec/16-estructura.md:
 * "apps/api no importa de apps/web". Ninguna app aparte de apps/api puede importar Prisma,
 * pero eso no aplica acá — apps/api es justamente quien tiene el permiso.
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
              group: ['**/apps/web/**', '@fumibug/ui', '@fumibug/ui/*'],
              message:
                'apps/api no puede importar de apps/web ni de packages/ui (docs/spec/16-estructura.md, regla de dependencias).',
            },
          ],
        },
      ],
    },
  },
];
