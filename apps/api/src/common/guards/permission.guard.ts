import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey, PermissionScope } from '@fumibug/contracts';
import { httpApiError } from '../http/api-response';
import { RequestContextService } from '../tenant/request-context.service';
import type { RequestUser } from '../tenant/request-context';
import { isPublicRoute } from './public.decorator';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

/**
 * Tercer guard de la cadena (docs/spec/11-seguridad.md §K.2): exige que el usuario
 * tenga alguno de los permission keys de @RequirePermission. Corre después de
 * TenantGuard porque necesita el user ya publicado en el contexto.
 *
 * Sin @RequirePermission en el handler, deja pasar: hay endpoints legítimos que solo
 * necesitan "autenticado + con tenant" sin un permiso de negocio puntual (GET /auth/me,
 * cualquier usuario ve su propia info). Es el mismo patrón "opt-out con @Public" que
 * JwtGuard/TenantGuard, invertido a opt-in — un endpoint de negocio nuevo declara su
 * permiso explícitamente, y que lo haga es parte del review (CLAUDE.md §10 checklist),
 * no algo que este guard pueda forzar por sí solo sin bloquear rutas legítimas.
 *
 * Sobre scope (own/team/tenant, §B.1): el JWT solo trae la lista plana de permission
 * keys (ver jwt.strategy.ts) — el scope de role_permissions no viaja token a token, se
 * resuelve una sola vez en la matriz del seed. Para los permisos que modelan el scope
 * en la propia key (service.read.own vs service.read.tenant, etc.) usar
 * `resolveReadScope()` en el handler. La revalidación fina contra DB en escrituras
 * sensibles (dinero, inventario, publicación, §B.1) es responsabilidad de cada módulo
 * de Fase 1, no de este guard genérico.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly context: RequestContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublicRoute(context, this.reflector)) return true;

    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const user = this.context.requireUser();
    const hasAny = required.some((key) => user.permissions.includes(key));
    if (!hasAny) {
      throw httpApiError('FORBIDDEN', `Falta el permiso requerido (${required.join(' o ')}).`, 403);
    }
    return true;
  }
}

/**
 * Resuelve el scope efectivo de lectura del usuario para un par own/tenant del
 * catálogo (§B.2). `tenant` gana si el usuario tiene ambas keys (es el más amplio).
 * `null` si no tiene ninguna — no debería pasar si @RequirePermission(own, tenant) ya
 * dejó pasar la request, pero el tipo lo modela por si se llama fuera de ese contexto.
 */
export function resolveReadScope(
  user: RequestUser,
  ownKey: PermissionKey,
  tenantKey: PermissionKey,
): PermissionScope | null {
  if (user.permissions.includes(tenantKey)) return 'tenant';
  if (user.permissions.includes(ownKey)) return 'own';
  return null;
}
