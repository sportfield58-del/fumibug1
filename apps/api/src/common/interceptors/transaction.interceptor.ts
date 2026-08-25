import { Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { defer, type Observable } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { isPublicRoute } from '../guards/public.decorator';
import { TenantPrismaService } from '../tenant/tenant-prisma.service';

/**
 * Capa 2 del aislamiento — docs/spec/11-seguridad.md §K.4.
 *
 * Envuelve CADA request autenticado en una transacción con `SET LOCAL
 * app.tenant_id` ya aplicado. Si el handler lanza, rollback automático. Los
 * servicios obtienen el cliente transaccional vía TenantPrismaService.current().
 *
 * Notas:
 * - Rutas @Public (health) no abren transacción: no tocan datos tenant-scoped.
 * - Endpoints de streaming/SSE futuros deberán marcar un escape (@NoTransaction)
 *   porque sostienen la conexión durante toda la respuesta. Hoy no existen.
 * - Este diseño deja listo el requisito de auditoría §K.10: la entrada de
 *   audit_logs se escribe en ESTA misma transacción (PR 7).
 */
@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: TenantPrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (isPublicRoute(context, this.reflector)) return next.handle();

    return defer(() =>
      this.db.runInRequestTransaction(async () => {
        const result = await lastValueFrom(next.handle() as Observable<unknown>);
        return result;
      }),
    );
  }
}
