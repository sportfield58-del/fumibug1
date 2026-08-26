import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@fumibug/db';
import type { PermissionKey } from '@fumibug/contracts';

/**
 * Usuario autenticado, extraído de los claims del JWT (docs/spec/11-seguridad.md §K.1).
 * El Auth Hook de Supabase inyecta `tenant_id`, `role_key` y `permissions[]` al emitir
 * el token; JwtStrategy los valida y mapea a esta forma. Los permisos se validan
 * contra el catálogo de @fumibug/contracts en la frontera: un claim desconocido
 * rechaza el token (fail closed).
 */
export interface RequestUser {
  userId: string;
  email: string | null;
  /** Tenant del usuario. Siempre presente: todo usuario pertenece a un tenant. */
  tenantId: string;
  roleKey: string;
  permissions: PermissionKey[];
}

/**
 * Estado por-request que viaja en AsyncLocalStorage (docs/spec/11-seguridad.md §K.2).
 *
 * `tx` es el cliente transaccional del request: lo abre TransactionInterceptor con
 * `SET LOCAL app.tenant_id` ya aplicado (Capa 2, §K.4). Los servicios lo obtienen vía
 * TenantPrismaService.current() y NUNCA abren transacciones propias — una mutación y
 * su registro de auditoría comparten transacción (§K.10).
 */
export interface RequestContext {
  requestId: string;
  user?: RequestUser;
  tenantId?: string;
  tx?: Prisma.TransactionClient;
  /** Para audit_logs.ip/user_agent (§K.10). Poblado por RequestMiddleware. */
  ip?: string;
  userAgent?: string;
}

/**
 * Instancia única de ALS para el proceso. Es module-level (no un provider) para que
 * la extensión de Prisma pueda leerla sin inyección de dependencias — Prisma no
 * conoce el contenedor de Nest.
 */
export const requestAls = new AsyncLocalStorage<RequestContext>();
