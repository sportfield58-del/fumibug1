// @ts-check
const base = require('./base');

/**
 * Preset para packages/contracts. Regla de docs/spec/16-estructura.md:
 * "packages/contracts no importa de nadie (sin dependencias más allá de Zod)".
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
              group: ['**/apps/**', '**/packages/db/**', '**/packages/ui/**'],
              message:
                'packages/contracts no puede depender de ninguna app ni de otro package (docs/spec/16-estructura.md). Solo Zod.',
            },
          ],
        },
      ],
    },
  },
];
