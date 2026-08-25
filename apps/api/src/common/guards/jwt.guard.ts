import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { httpApiError } from '../http/api-response';
import { RequestContextService } from '../tenant/request-context.service';
import { isPublicRoute } from './public.decorator';
import { JwtStrategy } from './jwt.strategy';

/**
 * Primer guard de la cadena (docs/spec/11-seguridad.md §K.2): verifica firma y
 * expiración del JWT vía JwtStrategy y publica el usuario en el RequestContext.
 * No toca la base: la autorización fina es de TenantGuard/PermissionGuard y los
 * permisos se revalidan contra DB en operaciones sensibles (PR 6+).
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly strategy: JwtStrategy,
    private readonly context: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublicRoute(context, this.reflector)) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ') || header.length <= 'Bearer '.length) {
      throw httpApiError('UNAUTHENTICATED', 'Falta el header Authorization Bearer.', 401);
    }

    const user = await this.strategy.verify(header.slice('Bearer '.length));
    req.user = user;
    this.context.get().user = user;
    return true;
  }
}
