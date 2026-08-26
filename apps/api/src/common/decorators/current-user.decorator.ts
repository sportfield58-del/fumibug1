import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../tenant/request-context';

/**
 * Inyecta el usuario autenticado (claims verificados por JwtGuard) en los parámetros
 * del handler. docs/spec/16-estructura.md §U: common/decorators = "@CurrentUser
 * @RequirePermission". @RequirePermission llega con PermissionGuard (PR 6).
 *
 * Recordatorio de §K.2: ocultar botones por permiso en el frontend NO es seguridad;
 * la verificación server-side es obligatoria en cada endpoint sensible.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser => {
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user) {
      throw new Error('@CurrentUser usado fuera de una ruta con JwtGuard.');
    }
    return user;
  },
);
