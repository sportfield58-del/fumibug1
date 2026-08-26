import { PrismaClient } from '@prisma/client';

// Reexporta todo lo generado por Prisma (modelos, enums, tipos de input) — es lo único
// que apps/api debería importar de acá, nunca "@prisma/client" directamente, para que
// el día que cambie la estrategia de generación (ej. output path custom) no haya que
// tocar cada módulo consumidor.
export * from '@prisma/client';

/**
 * Singleton de PrismaClient. La extensión que inyecta tenant_id (PR 5,
 * docs/spec/11-seguridad.md §K.4 Capa 1) envuelve esta instancia — no crear otra acá.
 * `SET LOCAL app.tenant_id` por transacción (Capa 2, RLS) también se cablea en PR 5.
 */
export const prisma = new PrismaClient();
