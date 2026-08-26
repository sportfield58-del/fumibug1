import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@fumibug/contracts';

/**
 * docs/spec/02-roles.md §B.1: "el código nunca pregunta if (user.role === 'ADMIN').
 * Pregunta if (can(user, 'route.publish'))". Este decorador es ese `can`.
 *
 * Acepta más de una key para el patrón own/tenant del catálogo (§B.2:
 * service.read.own/service.read.tenant, route.read.*, inventory.read.*, payment.read.*,
 * cash.read.*): el usuario pasa si tiene AL MENOS UNA. El handler decide qué filtro
 * aplicar según cuál de las dos efectivamente tiene — usar `resolveReadScope()` de
 * `permission.guard.ts` para eso, ver el comentario de PermissionGuard sobre por qué
 * el scope no viaja en el JWT.
 *
 * Sin este decorador, PermissionGuard deja pasar (ver PermissionGuard) — hay endpoints
 * legítimos que solo necesitan "autenticado + con tenant" (ej. GET /auth/me). Todo
 * endpoint de negocio nuevo tiene que declararlo explícitamente; es parte del checklist
 * de review (CLAUDE.md §10).
 */
export const REQUIRE_PERMISSION_KEY = 'fumibug:require-permission';

export const RequirePermission = (
  ...keys: [PermissionKey, ...PermissionKey[]]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_PERMISSION_KEY, keys);
