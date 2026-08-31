import { Injectable } from '@nestjs/common';
import type { AuditLog, AuditLogListQuery } from '@fumibug/contracts';
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

  /**
   * docs/spec/03-modulos.md §C.20 / contracts listAuditLogs (PR-210): GET /audit-logs.
   *
   * Cursor por `id` (BigInt autoincremental, append-only → estrictamente creciente),
   * pagina hacia atrás con `orderBy { id: 'desc' }` y `id < cursor`. El aislamiento por
   * tenant lo pone RLS + la extensión (AuditLog es tenant-scoped): un tenant solo ve sus
   * propios logs (R40). Append-only: nunca hay UPDATE/DELETE (trigger R42).
   */
  async listLogs(query: AuditLogListQuery): Promise<AuditLog[]> {
    const tx = this.db.current();
    const limit = query.limit ?? 20;

    const createdAt: Prisma.DateTimeFilter | undefined =
      query.from !== undefined || query.to !== undefined
        ? {
            ...(query.from !== undefined ? { gte: new Date(query.from) } : {}),
            ...(query.to !== undefined ? { lte: new Date(query.to) } : {}),
          }
        : undefined;

    const rows = await tx.auditLog.findMany({
      where: {
        ...(query.cursor !== undefined ? { id: { lt: BigInt(query.cursor) } } : {}),
        ...(query.entityType !== undefined ? { entityType: query.entityType } : {}),
        ...(query.entityId !== undefined ? { entityId: query.entityId } : {}),
        ...(query.actorUserId !== undefined ? { actorUserId: query.actorUserId } : {}),
        ...(query.severity !== undefined ? { severity: query.severity } : {}),
        ...(createdAt !== undefined ? { createdAt } : {}),
      },
      orderBy: [{ id: 'desc' }],
      take: limit,
    });

    return rows.map(toAuditLog);
  }
}

interface AuditLogRow {
  id: bigint;
  tenantId: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  diff: Prisma.JsonValue | null;
  severity: AuditSeverity;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
}

function toAuditLog(r: AuditLogRow): AuditLog {
  return {
    id: r.id.toString(),
    tenantId: r.tenantId,
    actorUserId: r.actorUserId ?? undefined,
    actorRole: r.actorRole ?? undefined,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId ?? undefined,
    before: r.before ?? undefined,
    after: r.after ?? undefined,
    diff: r.diff ?? undefined,
    severity: r.severity,
    ip: r.ip ?? undefined,
    userAgent: r.userAgent ?? undefined,
    requestId: r.requestId ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}
