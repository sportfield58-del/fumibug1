import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RequestContextService } from '../tenant/request-context.service';
import { isPublicRoute } from './public.decorator';

/**
 * Segundo guard de la cadena (§K.2): fija el tenant del request a partir de los
 * claims ya verificados por JwtGuard. Desde acá, la extensión de Prisma y el
 * `SET LOCAL app.tenant_id` de la transacción usan ESTE valor — es la única
 * fuente del tenant en todo el request.
 *
 * PR 6 agrega acá la verificación de suspensión: membership/tenant SUSPENDED →
 * 403 TENANT_SUSPENDED, consultando DB dentro de contexto seguro.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly context: RequestContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublicRoute(context, this.reflector)) return true;

    // requireUser() explota si JwtGuard no corrió antes: el orden de los
    // APP_GUARD en AppModule es parte del contrato de seguridad, no un detalle.
    const user = this.context.requireUser();

    const req = context.switchToHttp().getRequest<Request>();
    req.tenantId = user.tenantId;
    this.context.get().tenantId = user.tenantId;
    return true;
  }
}
