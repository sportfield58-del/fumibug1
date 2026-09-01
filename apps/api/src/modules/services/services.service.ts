import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CancelServiceRequest,
  CreateServiceRequest,
  RejectServiceRequest,
  ReopenServiceRequest,
  RescheduleServiceRequest,
  Service,
  ServiceListQuery,
  UpdateServiceRequest,
} from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StateMachineService } from '../../common/state-machine/state-machine.service';
import { httpApiError } from '../../common/http/api-response';
import { resolveReadScope } from '../../common/guards/permission.guard';
import type { RequestUser } from '../../common/tenant/request-context';
import type { RequestTx } from '../../common/tenant/prisma-tenant.extension';

/**
 * docs/spec/03-modulos.md §C.6, docs/spec/04-estados.md §D.3, contracts (PR-104).
 *
 * Transiciones de estado SIEMPRE vía StateMachineService (CLAUDE.md invariante #13) —
 * nunca `service.status = 'X'` directo. Código autogenerado `SVC-NNNNNN` correlativo
 * por tenant (contador simple: cuenta filas existentes + 1; una colisión rara bajo
 * concurrencia extrema la resuelve el @@unique([tenantId, code]) con un 409 de Prisma,
 * no hay negocio crítico en el gap numérico de `code` como sí lo hay en certificados
 * — ahí el correlativo sin huecos es R obligatoria, ver docs/spec/09-reglas.md).
 */
@Injectable()
export class ServicesService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly stateMachine: StateMachineService,
  ) {}

  async list(query: ServiceListQuery, actor: RequestUser): Promise<{ data: Service[]; meta: { hasMore: boolean } }> {
    const tx = this.db.current();
    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status;
    if (query.customerId) where['customerId'] = query.customerId;
    if (query.from || query.to) {
      where['scheduledDate'] = {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
      };
    }
    if (query.unassigned) where['routeStops'] = { none: {} };
    if (query.technicianId) {
      where['routeStops'] = { some: { route: { technicianId: query.technicianId } } };
    }

    // scope 'own' (operario sin service.read.tenant): solo ve servicios de sus propias
    // rutas, sin importar qué filtros haya pedido — nunca el catálogo completo del tenant.
    const scope = resolveReadScope(actor, 'service.read.own', 'service.read.tenant');
    if (scope === 'own') {
      where['routeStops'] = { some: { route: { technicianId: actor.userId } } };
    }

    const take = query.limit + 1;
    const rows = await tx.service.findMany({
      where,
      take,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ scheduledDate: 'desc' }, { id: 'desc' }],
      include: {
        customer: { select: { legalName: true, tradeName: true } },
        serviceLocation: { select: { addressLine: true, lat: true, lng: true } },
        serviceType: { select: { name: true } },
        routeStops: {
          where: { status: { not: 'CANCELLED' }, route: { status: { not: 'CANCELLED' } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { route: { select: { technician: { select: { id: true, fullName: true, username: true } } } } },
        },
      },
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return { data: page.map(toService), meta: { hasMore } };
  }

  async create(input: CreateServiceRequest, actor: RequestUser): Promise<Service> {
    const tx = this.db.current();
    const code = await this.nextCode(tx);

    const row = await tx.service.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        code,
        customerId: input.customerId,
        serviceLocationId: input.serviceLocationId,
        serviceTypeId: input.serviceTypeId,
        origin: 'MANUAL',
        status: 'DRAFT',
        targetPests: input.targetPests ?? [],
        scheduledDate: input.scheduledDate ? new Date(`${input.scheduledDate}T00:00:00.000Z`) : null,
        windowStart: input.windowStart ? new Date(`1970-01-01T${input.windowStart}Z`) : null,
        windowEnd: input.windowEnd ? new Date(`1970-01-01T${input.windowEnd}Z`) : null,
        estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
        requiredTechnicians: input.requiredTechnicians ?? 1,
        priceCents: BigInt(input.priceCents),
        priceListId: input.priceListId ?? null,
        priority: input.priority ?? 'NORMAL',
        notesInternal: input.notesInternal ?? null,
        notesForTechnician: input.notesForTechnician ?? null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    // Alta manual arranca en DRAFT; si ya viene con fecha, pasa a SCHEDULED de una —
    // evita que el admin tenga que hacer dos pasos para lo que en la práctica es uno.
    if (row.scheduledDate) {
      await this.stateMachine.transition({
        entity: 'service',
        id: row.id,
        from: 'DRAFT',
        to: 'SCHEDULED',
        actorId: actor.userId,
      });
    }

    await this.audit.record({
      action: 'service.create',
      entityType: 'service',
      entityId: row.id,
      severity: 'INFO',
      after: { code: row.code, status: row.scheduledDate ? 'SCHEDULED' : 'DRAFT' },
    });

    return this.getById(row.id);
  }

  async getById(id: string): Promise<Service> {
    const row = await this.db.current().service.findFirst({
      where: { id },
      include: {
        customer: { select: { legalName: true, tradeName: true } },
        serviceLocation: { select: { addressLine: true, lat: true, lng: true } },
        serviceType: { select: { name: true } },
        routeStops: {
          where: { status: { not: 'CANCELLED' }, route: { status: { not: 'CANCELLED' } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { route: { select: { technician: { select: { id: true, fullName: true, username: true } } } } },
        },
      },
    });
    if (!row) throw httpApiError('NOT_FOUND', 'Servicio no encontrado.', 404);
    return toService(row);
  }

  async update(id: string, input: UpdateServiceRequest, ifMatch: string | null): Promise<Service> {
    const tx = this.db.current();
    const existing = await tx.service.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Servicio no encontrado.', 404);
    assertIfMatch(ifMatch, existing.version);

    await tx.service.update({
      where: { id },
      data: {
        version: { increment: 1 },
        updatedBy: null,
        ...(input.serviceLocationId !== undefined ? { serviceLocationId: input.serviceLocationId } : {}),
        ...(input.serviceTypeId !== undefined ? { serviceTypeId: input.serviceTypeId } : {}),
        ...(input.targetPests !== undefined ? { targetPests: input.targetPests } : {}),
        ...(input.scheduledDate !== undefined
          ? { scheduledDate: input.scheduledDate ? new Date(`${input.scheduledDate}T00:00:00.000Z`) : null }
          : {}),
        ...(input.windowStart !== undefined
          ? { windowStart: input.windowStart ? new Date(`1970-01-01T${input.windowStart}Z`) : null }
          : {}),
        ...(input.windowEnd !== undefined
          ? { windowEnd: input.windowEnd ? new Date(`1970-01-01T${input.windowEnd}Z`) : null }
          : {}),
        ...(input.estimatedDurationMinutes !== undefined
          ? { estimatedDurationMinutes: input.estimatedDurationMinutes }
          : {}),
        ...(input.requiredTechnicians !== undefined ? { requiredTechnicians: input.requiredTechnicians } : {}),
        ...(input.priceCents !== undefined ? { priceCents: BigInt(input.priceCents) } : {}),
        ...(input.priceListId !== undefined ? { priceListId: input.priceListId } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.notesInternal !== undefined ? { notesInternal: input.notesInternal } : {}),
        ...(input.notesForTechnician !== undefined ? { notesForTechnician: input.notesForTechnician } : {}),
      },
    });

    await this.audit.record({ action: 'service.update', entityType: 'service', entityId: id });
    return this.getById(id);
  }

  async cancel(id: string, input: CancelServiceRequest, actor: RequestUser): Promise<Service> {
    const existing = await this.requireForTransition(id);
    await this.stateMachine.transition({
      entity: 'service',
      id,
      from: existing.status,
      to: 'CANCELLED',
      actorId: actor.userId,
      reason: input.reason,
    });
    await this.db.current().service.update({
      where: { id },
      data: { cancellationReason: input.reason, cancelledBillable: input.billable ?? false },
    });
    await this.audit.record({
      action: 'service.cancel',
      entityType: 'service',
      entityId: id,
      after: { reason: input.reason, billable: input.billable ?? false },
    });
    return this.getById(id);
  }

  async reschedule(id: string, input: RescheduleServiceRequest, actor: RequestUser): Promise<Service> {
    const existing = await this.requireForTransition(id);
    await this.stateMachine.transition({
      entity: 'service',
      id,
      from: existing.status,
      to: 'RESCHEDULED',
      actorId: actor.userId,
      reason: input.reason,
    });
    // §D.3: RESCHEDULED es transitorio, vuelve a SCHEDULED con la nueva fecha ya puesta
    // — el frontend no ve un estado intermedio "en el aire" entre las dos llamadas.
    await this.db.current().service.update({
      where: { id },
      data: { scheduledDate: new Date(`${input.newDate}T00:00:00.000Z`) },
    });
    await this.stateMachine.transition({
      entity: 'service',
      id,
      from: 'RESCHEDULED',
      to: 'SCHEDULED',
      actorId: actor.userId,
    });
    await this.audit.record({
      action: 'service.reschedule',
      entityType: 'service',
      entityId: id,
      after: { newDate: input.newDate, reason: input.reason },
    });
    return this.getById(id);
  }

  async validate(id: string, actor: RequestUser): Promise<Service> {
    const existing = await this.requireStatus(id, 'PENDING_VALIDATION');
    await this.stateMachine.transition({
      entity: 'service',
      id,
      from: existing.status,
      to: 'COMPLETED',
      actorId: actor.userId,
    });
    await this.audit.record({ action: 'service.validate', entityType: 'service', entityId: id });
    return this.getById(id);
  }

  async reject(id: string, input: RejectServiceRequest, actor: RequestUser): Promise<Service> {
    const existing = await this.requireStatus(id, 'PENDING_VALIDATION');
    await this.stateMachine.transition({
      entity: 'service',
      id,
      from: existing.status,
      to: 'IN_EXECUTION',
      actorId: actor.userId,
      reason: input.reason,
    });
    await this.audit.record({
      action: 'service.reject',
      entityType: 'service',
      entityId: id,
      after: { reason: input.reason },
    });
    return this.getById(id);
  }

  async reopen(id: string, input: ReopenServiceRequest, actor: RequestUser): Promise<Service> {
    const existing = await this.requireStatus(id, 'COMPLETED');
    await this.stateMachine.transition({
      entity: 'service',
      id,
      from: existing.status,
      to: 'IN_EXECUTION',
      actorId: actor.userId,
      reason: input.reason,
    });
    // R5: certificado emitido sobre este servicio queda anulado — Certificate es
    // Fase 2 (no existe la tabla poblada todavía), así que no hay nada que anular acá
    // hoy. Dejarlo anotado para cuando exista el módulo, no reinventarlo entonces.
    await this.audit.record({
      action: 'service.reopen',
      entityType: 'service',
      entityId: id,
      severity: 'WARNING',
      after: { reason: input.reason },
    });
    return this.getById(id);
  }

  async warrantyVisit(id: string, actor: RequestUser): Promise<Service> {
    const tx = this.db.current();
    const parent = await tx.service.findFirst({ where: { id } });
    if (!parent) throw httpApiError('NOT_FOUND', 'Servicio no encontrado.', 404);

    const code = await this.nextCode(tx);
    const row = await tx.service.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        code,
        customerId: parent.customerId,
        serviceLocationId: parent.serviceLocationId,
        serviceTypeId: parent.serviceTypeId,
        parentServiceId: parent.id,
        origin: 'WARRANTY',
        status: 'DRAFT',
        targetPests: parent.targetPests,
        requiredTechnicians: parent.requiredTechnicians,
        priceCents: 0n, // R: revisita de garantía no genera ingreso
        isWarrantyVisit: true,
        priority: parent.priority,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    await this.audit.record({
      action: 'service.warranty-visit',
      entityType: 'service',
      entityId: row.id,
      severity: 'INFO',
      after: { parentServiceId: parent.id },
    });

    return this.getById(row.id);
  }

  private async requireForTransition(id: string): Promise<{ status: Service['status'] }> {
    const row = await this.db.current().service.findFirst({ where: { id }, select: { status: true } });
    if (!row) throw httpApiError('NOT_FOUND', 'Servicio no encontrado.', 404);
    return row;
  }

  private async requireStatus(id: string, expected: Service['status']): Promise<{ status: Service['status'] }> {
    const row = await this.requireForTransition(id);
    if (row.status !== expected) {
      throw httpApiError(
        'STATE_CONFLICT',
        `El servicio está en ${row.status}, se esperaba ${expected}.`,
        409,
      );
    }
    return row;
  }

  private async nextCode(tx: RequestTx): Promise<string> {
    const count = await tx.service.count();
    return `SVC-${String(count + 1).padStart(6, '0')}`;
  }
}

function assertIfMatch(ifMatch: string | null, version: number): void {
  const expectedEtag = `"${version}"`;
  if (!ifMatch || ifMatch.trim() !== expectedEtag) {
    throw httpApiError('VERSION_CONFLICT', 'If-Match no coincide: actualizá tus datos.', 409);
  }
}

interface ServiceRow {
  id: string;
  tenantId: string;
  code: string;
  customerId: string;
  serviceLocationId: string;
  serviceTypeId: string;
  contractId: string | null;
  parentServiceId: string | null;
  origin: string;
  status: string;
  targetPests: string[];
  scheduledDate: Date | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  estimatedDurationMinutes: number | null;
  requiredTechnicians: number;
  priceCents: bigint;
  currency: string;
  priceListId: string | null;
  isWarrantyVisit: boolean;
  warrantyUntil: Date | null;
  priority: string;
  notesInternal: string | null;
  notesForTechnician: string | null;
  cancellationReason: string | null;
  cancelledBillable: boolean | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  customer?: { legalName: string; tradeName: string | null };
  serviceLocation?: { addressLine: string; lat: unknown; lng: unknown };
  serviceType?: { name: string };
  routeStops?: Array<{
    route: { technician: { id: string; fullName: string | null; username: string | null } | null } | null;
  }>;
}

function toService(r: ServiceRow): Service {
  return {
    id: r.id,
    tenantId: r.tenantId,
    code: r.code,
    customerId: r.customerId,
    serviceLocationId: r.serviceLocationId,
    serviceTypeId: r.serviceTypeId,
    contractId: r.contractId,
    parentServiceId: r.parentServiceId,
    origin: r.origin as Service['origin'],
    status: r.status as Service['status'],
    targetPests: r.targetPests,
    scheduledDate: r.scheduledDate ? r.scheduledDate.toISOString().slice(0, 10) : null,
    windowStart: r.windowStart ? r.windowStart.toISOString().slice(11, 19) : null,
    windowEnd: r.windowEnd ? r.windowEnd.toISOString().slice(11, 19) : null,
    estimatedDurationMinutes: r.estimatedDurationMinutes,
    requiredTechnicians: r.requiredTechnicians,
    priceCents: Number(r.priceCents),
    currency: r.currency,
    priceListId: r.priceListId,
    isWarrantyVisit: r.isWarrantyVisit,
    warrantyUntil: r.warrantyUntil ? r.warrantyUntil.toISOString().slice(0, 10) : null,
    priority: r.priority as Service['priority'],
    notesInternal: r.notesInternal,
    notesForTechnician: r.notesForTechnician,
    cancellationReason: r.cancellationReason as Service['cancellationReason'],
    cancelledBillable: r.cancelledBillable,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    customerName: r.customer ? (r.customer.tradeName ?? r.customer.legalName) : null,
    serviceTypeName: r.serviceType?.name ?? null,
    technicianId: r.routeStops?.[0]?.route?.technician?.id ?? null,
    technicianName:
      r.routeStops?.[0]?.route?.technician?.fullName ??
      r.routeStops?.[0]?.route?.technician?.username ??
      null,
    location: r.serviceLocation
      ? {
          addressLine: r.serviceLocation.addressLine,
          lat: r.serviceLocation.lat !== null ? Number(r.serviceLocation.lat) : null,
          lng: r.serviceLocation.lng !== null ? Number(r.serviceLocation.lng) : null,
        }
      : null,
  };
}
