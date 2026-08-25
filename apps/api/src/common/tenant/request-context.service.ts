import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { requestAls, type RequestContext, type RequestUser } from './request-context';

/**
 * Acceso tipado al contexto del request actual. Los guards escriben (user, tenantId),
 * la extensión de Prisma y los servicios leen. Si falta el store es un bug de wiring
 * (el middleware no corrió) y se hace exploto en lugar de scopear queries a nada.
 */
@Injectable()
export class RequestContextService {
  /** Abre un nuevo contexto para toda la cadena async del request. */
  run<T>(context: RequestContext, fn: () => T): T {
    return requestAls.run(context, fn);
  }

  /** Contexto del request en curso; lanza si no hay (middleware no registrado). */
  get(): RequestContext {
    const store = requestAls.getStore();
    if (!store) {
      throw new Error(
        'No hay RequestContext: RequestMiddleware no corrió para esta ruta. ' +
          'Revisar AppModule.configure().',
      );
    }
    return store;
  }

  getOrNull(): RequestContext | undefined {
    return requestAls.getStore();
  }

  /** requestId para envelopes de error y logs (docs/spec/10-api.md §J.1). */
  requestIdOrDefault(): string {
    return this.getOrNull()?.requestId ?? randomUUID();
  }

  requireUser(): RequestUser {
    const { user } = this.get();
    if (!user) {
      throw new Error(
        'RequestContext sin user: TenantGuard requiere que JwtGuard corra primero ' +
          '(orden de APP_GUARD, docs/spec/11-seguridad.md §K.2).',
      );
    }
    return user;
  }

  requireTenantId(): string {
    const { tenantId } = this.get();
    if (!tenantId) throw new Error('RequestContext sin tenantId: falta TenantGuard.');
    return tenantId;
  }
}
