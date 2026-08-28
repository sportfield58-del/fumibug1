/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: 'test/.*\\.e2e\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 30000,
  // Cada archivo *.e2e.ts corre `ALTER ROLE fumibug_app WITH PASSWORD ...` en su
  // beforeAll contra el MISMO Postgres compartido (§K.4 / CI): en paralelo, dos
  // workers mutando el mismo rol chocan con "tuple concurrently updated" (error real
  // de Postgres, no un bug de negocio — apareció al sumar el segundo archivo e2e).
  // Estos tests igual son pesados (levantan Nest completo por archivo); serializar no
  // cuesta nada que ya no estuviera pagándose.
  maxWorkers: 1,
};
