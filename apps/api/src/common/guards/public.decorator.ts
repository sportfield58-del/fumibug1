import { SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

/**
 * Marca rutas que NO requieren autenticación (health check, y en PR 6 el login
 * proxy a Supabase si corresponde). docs/spec/11-seguridad.md §K.2: los guards se
 * componen; @Public corta la cadena JwtGuard → TenantGuard.
 *
 * Ojo: "pública" no significa sin auditoría ni rate limit — esos interceptores de
 * PR 7 deciden por su cuenta.
 */
export const IS_PUBLIC_KEY = 'fumibug:public';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Lectura compartida por JwtGuard, TenantGuard y TransactionInterceptor. */
export function isPublicRoute(context: ExecutionContext, reflector: Reflector): boolean {
  return (
    reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true
  );
}
