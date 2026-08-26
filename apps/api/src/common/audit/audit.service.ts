import { Injectable } from '@nestjs/common';
import type { AuditSeverity, Prisma } from '@fumibug/db';
import { RequestContextService } from '../tenant/request-context.service';
import { TenantPrismaService } from '../tenant/tenant-prisma.service';

export interface AuditRecordInput {
  action: string;
  entityType: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  diff?: Prisma.InputJsonValue;
  /** default INFO. CRITICAL: revisión periódica obligatoria (§K.10, lista cerrada). */
  severity?: AuditSeverity;
}

/**
 * docs/spec/11-seguridad.md §K.10: "se escribe en la misma transacción que la mutación
 * (si no, hay operaciones sin rastro cuando falla el log)".
 *
 * Es un servicio explícito, no un interceptor genérico: generar el diff antes/después
 * automáticamente para CUALQUIER mutación necesitaría reflexión sobre qué modelo de
 * Prisma se está tocando, y en Fase 0 no hay ninguna mutación de negocio real contra la
 * cual probar esa generalización sin especular. Cada módulo de Fase 1 llama
 * `audit.record(...)` explícitamente en el punto donde muta — y como usa
 * `TenantPrismaService.current()` (la MISMA transacción del request, nunca una propia),
 * el requisito de "misma transacción" se cumple automáticamente sin que el que llama
 * tenga que pensarlo.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly context: RequestContextService,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    const store = this.context.get();
    const tenantId = this.context.requireTenantId();
    const tx = this.db.current();

    // exactOptionalPropertyTypes: Prisma tipa estos campos opcionales como
    // "string | null" (si están), no "string | undefined" — se omite la key en vez
    // de asignarle undefined explícitamente.
    await tx.auditLog.create({
      data: {
        tenantId,
        action: input.action,
        entityType: input.entityType,
        severity: input.severity ?? 'INFO',
        requestId: store.requestId,
        ...(store.user?.userId !== undefined ? { actorUserId: store.user.userId } : {}),
        ...(store.user?.roleKey !== undefined ? { actorRole: store.user.roleKey } : {}),
        ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
        ...(input.before !== undefined ? { before: input.before } : {}),
        ...(input.after !== undefined ? { after: input.after } : {}),
        ...(input.diff !== undefined ? { diff: input.diff } : {}),
        ...(store.ip !== undefined ? { ip: store.ip } : {}),
        ...(store.userAgent !== undefined ? { userAgent: store.userAgent } : {}),
      },
    });
  }
}
