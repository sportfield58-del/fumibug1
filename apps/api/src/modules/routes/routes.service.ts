import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AddStopRequest,
  CreateRouteRequest,
  ReassignRouteRequest,
  ReorderStopsRequest,
  Route,
  RouteListQuery,
  RouteValidationResponse,
  RouteWithStops,
  UpdateRouteRequest,
} from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StateMachineService } from '../../common/state-machine/state-machine.service';
import { httpApiError } from '../../common/http/api-response';
import { resolveReadScope } from '../../common/guards/permission.guard';
import type { RequestUser } from '../../common/tenant/request-context';
import type { RequestTx } from '../../common/tenant/prisma-tenant.extension';

/**
 * docs/spec/03-modulos.md §C.7/§C.8, docs/spec/09-reglas.md R12-R15, contracts (PR-105).
 *
 * R12 (publicar es atómico) y R14 (despublicar solo si nada arrancó) se resuelven
 * gratis por estar todo dentro de la misma transacción de request
 * (TransactionInterceptor) — si algo de acá adentro lanza, Nest hace rollback de
 * TODO, ruta y servicios incluidos, no hace falta un $transaction manual.
 */
@Injectable()
export class RoutesService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly stateMachine: StateMachineService,
  ) {}

  async list(query: RouteListQuery, actor: RequestUser): Promise<Route[]> {
    const tx = this.db.current();
    const where: Record<string, unknown> = {};
    if (query.date) where['routeDate'] = new Date(`${query.date}T00:00:00.000Z`);
    if (query.status) where['status'] = query.status;

    const scope = resolveReadScope(actor, 'route.read.own', 'route.read.tenant');
    if (scope === 'own') {
      where['technicianId'] = actor.userId;
    } else if (query.technicianId) {
      where['technicianId'] = query.technicianId;
    }

    const take = query.limit + 1;
    const rows = await tx.route.findMany({
      where,
      take,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ routeDate: 'desc' }, { id: 'desc' }],
      include: { technician: { select: { fullName: true, username: true, email: true } } },
    });
    return rows.slice(0, query.limit).map(toRoute);
  }

  async create(input: CreateRouteRequest, actor: RequestUser): Promise<Route> {
    const tx = this.db.current();
    const code = await this.nextCode(tx);
    const row = await tx.route.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        code,
        technicianId: input.technicianId,
        vehicleId: input.vehicleId ?? null,
        routeDate: new Date(`${input.date}T00:00:00.000Z`),
        status: 'DRAFT',
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
    await this.audit.record({
      action: 'route.create',
      entityType: 'route',
      entityId: row.id,
      severity: 'INFO',
      after: { technicianId: row.technicianId, routeDate: input.date },
    });
    return toRoute(row);
  }

  async getById(id: string): Promise<RouteWithStops> {
    const tx = this.db.current();
    const row = await tx.route.findFirst({
      where: { id },
      include: { technician: { select: { fullName: true, username: true, email: true } } },
    });
    if (!row) throw httpApiError('NOT_FOUND', 'Ruta no encontrada.', 404);
    const stops = await tx.routeStop.findMany({
      where: { routeId: id },
      orderBy: { sequence: 'asc' },
      include: {
        service: {
          include: {
            customer: { select: { legalName: true, tradeName: true } },
            serviceLocation: { select: { addressLine: true, lat: true, lng: true } },
          },
        },
      },
    });
    return { ...toRoute(row), stops: stops.map(toRouteStop) };
  }

  async update(id: string, input: UpdateRouteRequest, ifMatch: string | null): Promise<RouteWithStops> {
    const tx = this.db.current();
    const existing = await tx.route.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Ruta no encontrada.', 404);
    assertIfMatch(ifMatch, existing.version);

    await tx.route.update({
      where: { id },
      data: {
        version: { increment: 1 },
        ...(input.vehicleId !== undefined ? { vehicleId: input.vehicleId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    await this.audit.record({ action: 'route.update', entityType: 'route', entityId: id });
    return this.getById(id);
  }

  async addStop(routeId: string, input: AddStopRequest, actor: RequestUser): Promise<RouteWithStops> {
    const tx = this.db.current();
    const route = await tx.route.findFirst({ where: { id: routeId } });
    if (!route) throw httpApiError('NOT_FOUND', 'Ruta no encontrada.', 404);

    await this.assertLicenseValid(tx, route.technicianId, route.routeDate);

    const service = await tx.service.findFirst({ where: { id: input.serviceId } });
    if (!service) throw httpApiError('NOT_FOUND', 'Servicio no encontrado.', 404);

    const maxSeq = await tx.routeStop.aggregate({ where: { routeId }, _max: { sequence: true } });
    const nextSequence = (maxSeq._max.sequence ?? 0) + 1;

    await tx.routeStop.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        routeId,
        serviceId: input.serviceId,
        sequence: nextSequence,
        status: 'PENDING',
        travelMinutes: input.travelMinutes ?? null,
      },
    });

    if (service.status === 'SCHEDULED') {
      await this.stateMachine.transition({
        entity: 'service',
        id: service.id,
        from: 'SCHEDULED',
        to: 'ASSIGNED',
        actorId: actor.userId,
      });
    }

    await this.audit.record({
      action: 'route.add-stop',
      entityType: 'route',
      entityId: routeId,
      after: { serviceId: input.serviceId, sequence: nextSequence },
    });
    return this.getById(routeId);
  }

  async reorderStops(routeId: string, input: ReorderStopsRequest): Promise<RouteWithStops> {
    const tx = this.db.current();
    const route = await tx.route.findFirst({ where: { id: routeId } });
    if (!route) throw httpApiError('NOT_FOUND', 'Ruta no encontrada.', 404);

    const stops = await tx.routeStop.findMany({ where: { routeId } });
    const stopIds = new Set(stops.map((s) => s.id));
    if (input.stopIds.length !== stops.length || !input.stopIds.every((id) => stopIds.has(id))) {
      throw httpApiError('VALIDATION_ERROR', 'stopIds debe incluir exactamente todos los stops de la ruta.', 400);
    }
    // R13: solo se reordenan stops en PENDING — uno que ya arrancó mantiene su lugar.
    const nonPending = stops.filter((s) => s.status !== 'PENDING');
    for (const s of nonPending) {
      const requestedIndex = input.stopIds.indexOf(s.id);
      if (requestedIndex !== stops.findIndex((x) => x.id === s.id)) {
        throw httpApiError(
          'BUSINESS_RULE_VIOLATION',
          `El stop ${s.id} ya no está PENDING, no se puede reordenar (R13).`,
          422,
        );
      }
    }

    // UNIQUE(route_id, sequence) DEFERRABLE INITIALLY DEFERRED (schema.prisma) — el
    // constraint se chequea al COMMIT, así que este loop puede pasar por estados
    // intermedios con secuencias repetidas sin violar nada a mitad de camino.
    for (const [i, stopId] of input.stopIds.entries()) {
      await tx.routeStop.update({ where: { id: stopId }, data: { sequence: i + 1 } });
    }

    await this.audit.record({ action: 'route.reorder-stops', entityType: 'route', entityId: routeId });
    return this.getById(routeId);
  }

  async removeStop(routeId: string, stopId: string, actor: RequestUser): Promise<RouteWithStops> {
    const tx = this.db.current();
    const stop = await tx.routeStop.findFirst({ where: { id: stopId, routeId } });
    if (!stop) throw httpApiError('NOT_FOUND', 'Stop no encontrado.', 404);
    if (stop.status !== 'PENDING') {
      throw httpApiError('BUSINESS_RULE_VIOLATION', 'Solo se puede quitar un stop en PENDING (R13).', 422);
    }

    await tx.routeStop.delete({ where: { id: stopId } });

    const service = await tx.service.findFirst({ where: { id: stop.serviceId } });
    if (service?.status === 'ASSIGNED') {
      await this.stateMachine.transition({
        entity: 'service',
        id: service.id,
        from: 'ASSIGNED',
        to: 'SCHEDULED',
        actorId: actor.userId,
      });
    }

    await this.audit.record({ action: 'route.remove-stop', entityType: 'route', entityId: routeId, after: { stopId } });
    return this.getById(routeId);
  }

  async validate(routeId: string): Promise<RouteValidationResponse> {
    const tx = this.db.current();
    const route = await tx.route.findFirst({ where: { id: routeId } });
    if (!route) throw httpApiError('NOT_FOUND', 'Ruta no encontrada.', 404);

    const blockers: RouteValidationResponse['blockers'] = [];
    const warnings: RouteValidationResponse['warnings'] = [];

    const profile = await tx.technicianProfile.findUnique({ where: { userId: route.technicianId } });
    if (profile?.licenseExpiresAt && profile.licenseExpiresAt < route.routeDate) {
      blockers.push({
        code: 'ROUTE_TECHNICIAN_LICENSE_EXPIRED',
        message: 'La libreta sanitaria del operario vence antes de la fecha de la ruta (R15).',
        stopId: null,
      });
    }

    const stops = await tx.routeStop.findMany({ where: { routeId } });
    if (stops.length === 0) {
      blockers.push({ code: 'ROUTE_EMPTY', message: 'La ruta no tiene stops.', stopId: null });
    }

    // Advertencias más finas (solapamiento horario, ventana del cliente, stock —
    // §C.7) quedan para cuando exista la info de duración/traslado real y de stock
    // por operario (Fase 2 / PR de inventario) — no bloquean, así que omitirlas hoy
    // no cambia el resultado de "¿puedo publicar?", que es lo que R12 exige proteger.
    return { canPublish: blockers.length === 0, blockers, warnings };
  }

  async publish(routeId: string, actor: RequestUser): Promise<RouteWithStops> {
    const tx = this.db.current();
    const route = await tx.route.findFirst({ where: { id: routeId } });
    if (!route) throw httpApiError('NOT_FOUND', 'Ruta no encontrada.', 404);
    if (route.status !== 'DRAFT' && route.status !== 'READY') {
      throw httpApiError('STATE_CONFLICT', `La ruta está en ${route.status}, no se puede publicar.`, 409);
    }

    const result = await this.validate(routeId);
    if (!result.canPublish) {
      throw httpApiError(
        'BUSINESS_RULE_VIOLATION',
        `No se puede publicar: ${result.blockers.map((b) => b.message).join(' ')}`,
        422,
        result.blockers.map((b) => ({ code: 'BUSINESS_RULE_VIOLATION', message: b.message })),
      );
    }

    // §D.4: DRAFT ⇄ READY ──► PUBLISHED — no hay borde directo DRAFT→PUBLISHED en la
    // tabla de transiciones (READY existe para separar "armando" de "lista pero no
    // publicada todavía", §D.4). El contrato no expone una acción "marcar lista"
    // aparte — publish() la atraviesa como paso interno cuando hace falta, dentro de
    // la misma transacción (sigue siendo atómico para R12).
    if (route.status === 'DRAFT') {
      await this.stateMachine.transition({ entity: 'route', id: routeId, from: 'DRAFT', to: 'READY', actorId: actor.userId });
    }
    // R12: ruta a PUBLISHED, TODOS los servicios ASSIGNED de sus stops a DISPATCHED —
    // atómico porque comparte la transacción del request (TransactionInterceptor).
    await this.stateMachine.transition({ entity: 'route', id: routeId, from: 'READY', to: 'PUBLISHED', actorId: actor.userId });

    const stops = await tx.routeStop.findMany({ where: { routeId }, include: { service: true } });
    for (const stop of stops) {
      if (stop.service.status === 'ASSIGNED') {
        await this.stateMachine.transition({
          entity: 'service',
          id: stop.serviceId,
          from: 'ASSIGNED',
          to: 'DISPATCHED',
          actorId: actor.userId,
        });
      }
    }

    await tx.route.update({ where: { id: routeId }, data: { publishedAt: new Date(), publishedBy: actor.userId } });

    // Notificación (§C.7/§C.18): Notification es Fase 1 pero el módulo con endpoint
    // propio todavía no existe (no está en el task board actual) — se agrega cuando
    // exista, no se inventa el shape acá.
    await this.audit.record({
      action: 'route.publish',
      entityType: 'route',
      entityId: routeId,
      severity: 'INFO',
      after: { stopsCount: stops.length },
    });
    return this.getById(routeId);
  }

  async unpublish(routeId: string, actor: RequestUser): Promise<RouteWithStops> {
    const tx = this.db.current();
    const route = await tx.route.findFirst({ where: { id: routeId } });
    if (!route) throw httpApiError('NOT_FOUND', 'Ruta no encontrada.', 404);
    if (route.status !== 'PUBLISHED') {
      throw httpApiError('STATE_CONFLICT', `La ruta está en ${route.status}, no se puede despublicar.`, 409);
    }

    const stops = await tx.routeStop.findMany({ where: { routeId } });
    const started = stops.filter((s) => s.status !== 'PENDING');
    if (started.length > 0) {
      throw httpApiError(
        'BUSINESS_RULE_VIOLATION',
        `No se puede despublicar: ${started.length} stop(s) ya salieron de PENDING (R14).`,
        422,
      );
    }

    await this.stateMachine.transition({ entity: 'route', id: routeId, from: 'PUBLISHED', to: 'DRAFT', actorId: actor.userId });

    const withServices = await tx.routeStop.findMany({ where: { routeId }, include: { service: true } });
    for (const stop of withServices) {
      if (stop.service.status === 'DISPATCHED') {
        await this.stateMachine.transition({
          entity: 'service',
          id: stop.serviceId,
          from: 'DISPATCHED',
          to: 'ASSIGNED',
          actorId: actor.userId,
        });
      }
    }

    await tx.route.update({ where: { id: routeId }, data: { publishedAt: null, publishedBy: null } });
    await this.audit.record({ action: 'route.unpublish', entityType: 'route', entityId: routeId, severity: 'WARNING' });
    return this.getById(routeId);
  }

  async reassign(routeId: string, input: ReassignRouteRequest): Promise<RouteWithStops> {
    const tx = this.db.current();
    const route = await tx.route.findFirst({ where: { id: routeId } });
    if (!route) throw httpApiError('NOT_FOUND', 'Ruta no encontrada.', 404);
    await this.assertLicenseValid(tx, input.newTechnicianId, route.routeDate);

    await tx.route.update({
      where: { id: routeId },
      data: { technicianId: input.newTechnicianId, version: { increment: 1 } },
    });
    await this.audit.record({
      action: 'route.reassign',
      entityType: 'route',
      entityId: routeId,
      severity: 'WARNING',
      before: { technicianId: route.technicianId },
      after: { technicianId: input.newTechnicianId },
    });
    return this.getById(routeId);
  }

  async cancel(routeId: string, actor: RequestUser): Promise<RouteWithStops> {
    const existing = await this.db.current().route.findFirst({ where: { id: routeId }, select: { status: true } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Ruta no encontrada.', 404);
    await this.stateMachine.transition({
      entity: 'route',
      id: routeId,
      from: existing.status,
      to: 'CANCELLED',
      actorId: actor.userId,
    });
    await this.audit.record({ action: 'route.cancel', entityType: 'route', entityId: routeId, severity: 'WARNING' });
    return this.getById(routeId);
  }

  /** R15: bloqueo duro, nunca advertencia — un operario con libreta vencida no puede tener stops. */
  private async assertLicenseValid(tx: RequestTx, technicianId: string, routeDate: Date): Promise<void> {
    const profile = await tx.technicianProfile.findUnique({ where: { userId: technicianId } });
    if (profile?.licenseExpiresAt && profile.licenseExpiresAt < routeDate) {
      throw httpApiError(
        'BUSINESS_RULE_VIOLATION',
        'El operario tiene la libreta sanitaria vencida para la fecha de la ruta (R15).',
        422,
      );
    }
  }

  private async nextCode(tx: RequestTx): Promise<string> {
    const count = await tx.route.count();
    return `RT-${String(count + 1).padStart(6, '0')}`;
  }
}

function assertIfMatch(ifMatch: string | null, version: number): void {
  const expectedEtag = `"${version}"`;
  if (!ifMatch || ifMatch.trim() !== expectedEtag) {
    throw httpApiError('VERSION_CONFLICT', 'If-Match no coincide: actualizá tus datos.', 409);
  }
}

interface RouteRow {
  id: string;
  tenantId: string;
  code: string;
  technicianId: string;
  vehicleId: string | null;
  routeDate: Date;
  status: string;
  publishedAt: Date | null;
  publishedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  technician?: { fullName: string | null; username: string | null; email: string };
}

function toRoute(r: RouteRow): Route {
  return {
    id: r.id,
    tenantId: r.tenantId,
    code: r.code,
    technicianId: r.technicianId,
    vehicleId: r.vehicleId,
    routeDate: r.routeDate.toISOString().slice(0, 10),
    status: r.status as Route['status'],
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    publishedBy: r.publishedBy,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    notes: r.notes,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    technicianName: r.technician ? (r.technician.fullName ?? r.technician.username ?? r.technician.email) : null,
  };
}

interface RouteStopRow {
  id: string;
  tenantId: string;
  routeId: string;
  serviceId: string;
  sequence: number;
  status: string;
  eta: Date | null;
  travelMinutes: number | null;
  enRouteAt: Date | null;
  arrivedAt: Date | null;
  arrivalLat: unknown;
  arrivalLng: unknown;
  arrivalAccuracyM: unknown;
  gpsStatus: string | null;
  distanceFromLocationM: number | null;
  outcomeReason: string | null;
  wastedTrip: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  service?: {
    customer: { legalName: string; tradeName: string | null } | null;
    serviceLocation: { addressLine: string; lat: unknown; lng: unknown } | null;
  };
}

function toRouteStop(r: RouteStopRow): RouteWithStops['stops'][number] {
  const loc = r.service?.serviceLocation;
  const customer = r.service?.customer;
  return {
    id: r.id,
    tenantId: r.tenantId,
    routeId: r.routeId,
    serviceId: r.serviceId,
    sequence: r.sequence,
    status: r.status as RouteWithStops['stops'][number]['status'],
    eta: r.eta ? r.eta.toISOString().slice(11, 19) : null,
    travelMinutes: r.travelMinutes,
    enRouteAt: r.enRouteAt ? r.enRouteAt.toISOString() : null,
    arrivedAt: r.arrivedAt ? r.arrivedAt.toISOString() : null,
    arrivalLat: r.arrivalLat !== null ? Number(r.arrivalLat) : null,
    arrivalLng: r.arrivalLng !== null ? Number(r.arrivalLng) : null,
    arrivalAccuracyM: r.arrivalAccuracyM !== null ? Number(r.arrivalAccuracyM) : null,
    gpsStatus: r.gpsStatus as RouteWithStops['stops'][number]['gpsStatus'],
    distanceFromLocationM: r.distanceFromLocationM,
    outcomeReason: r.outcomeReason as RouteWithStops['stops'][number]['outcomeReason'],
    wastedTrip: r.wastedTrip,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    location: loc
      ? {
          customerName: customer ? (customer.tradeName ?? customer.legalName) : '',
          addressLine: loc.addressLine,
          lat: loc.lat !== null ? Number(loc.lat) : null,
          lng: loc.lng !== null ? Number(loc.lng) : null,
        }
      : null,
  };
}
