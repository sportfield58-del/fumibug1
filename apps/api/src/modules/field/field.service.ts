import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@fumibug/db';
import type {
  CashClosure,
  CreateSupplyUsageRequest,
  FieldCashCloseRequest,
  FieldStop,
  FieldTodayResponse,
  FinishSessionRequest,
  FinishSessionResponse,
  InventoryBalance,
  Payment,
  ServiceSession,
  SessionActionRequest,
  ServiceSupplyUsage,
  SessionPaymentRequest,
  SessionSignatureRequest,
  StartSessionRequest,
  StopGpsEventRequest,
  StopOutcomeRequest,
} from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StateMachineService } from '../../common/state-machine/state-machine.service';
import { httpApiError } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import type { RequestTx } from '../../common/tenant/prisma-tenant.extension';
import { InventoryService } from '../inventory/inventory.service';
import { CashService } from '../cash/cash.service';
import { argentinaTodayUtcMidnight } from '../../common/date/argentina-date';

/**
 * docs/spec/03-modulos.md §C.10 "Ejecución de servicios", docs/spec/10-api.md §J.2,
 * docs/spec/09-reglas.md R2-R10/R16-R18/R43-R48.
 *
 * Todas las escrituras acá dan por sentado que el actor ES el operario dueño del
 * recurso — no hay una noción de "field admin" tocando la sesión de otro. Por eso el
 * check de pertenencia siempre es `=== actor.userId`, y su falla es NOT_FOUND (mismo
 * criterio de "no distinguir de un 403" que R40, aunque acá el límite es de dueño de
 * recurso, no de tenant).
 *
 * Evidencia real (fotos) NO está wireada todavía (PR-207, pendiente bucket de
 * Supabase Storage) — el checklist de finish() lo refleja honestamente: sin fotos
 * cargadas, R4 bloquea el cierre con el mensaje exacto de qué falta, que es el
 * comportamiento correcto de la regla, no un bug.
 */
@Injectable()
export class FieldService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly stateMachine: StateMachineService,
    private readonly inventory: InventoryService,
    private readonly cash: CashService,
  ) {}

  // --- Bundle del día ---

  async getToday(actor: RequestUser): Promise<FieldTodayResponse> {
    const tx = this.db.current();
    const routeRow = await tx.route.findFirst({
      where: { technicianId: actor.userId, routeDate: argentinaTodayUtcMidnight(), status: { in: ['PUBLISHED', 'IN_PROGRESS'] } },
    });

    let stops: FieldStop[] = [];
    if (routeRow) {
      const rows = await tx.routeStop.findMany({
        where: { routeId: routeRow.id },
        orderBy: { sequence: 'asc' },
        include: {
          service: {
            include: {
              customer: { select: { legalName: true, tradeName: true } },
              serviceLocation: { select: { addressLine: true, lat: true, lng: true } },
              serviceType: { select: { name: true } },
            },
          },
        },
      });
      stops = rows.map(toFieldStop);
    }

    const myStock: InventoryBalance[] = await this.inventory.listInventory({}, actor);

    return {
      route: routeRow
        ? {
            id: routeRow.id,
            tenantId: routeRow.tenantId,
            code: routeRow.code,
            technicianId: routeRow.technicianId,
            vehicleId: routeRow.vehicleId,
            routeDate: routeRow.routeDate.toISOString().slice(0, 10),
            status: routeRow.status,
            publishedAt: routeRow.publishedAt ? routeRow.publishedAt.toISOString() : null,
            publishedBy: routeRow.publishedBy,
            startedAt: routeRow.startedAt ? routeRow.startedAt.toISOString() : null,
            completedAt: routeRow.completedAt ? routeRow.completedAt.toISOString() : null,
            notes: routeRow.notes,
            version: routeRow.version,
            createdAt: routeRow.createdAt.toISOString(),
            updatedAt: routeRow.updatedAt.toISOString(),
          }
        : null,
      stops,
      myStock,
    };
  }

  // --- Stops (R47/R48: el GPS nunca bloquea) ---

  async markEnRoute(stopId: string, input: StopGpsEventRequest, actor: RequestUser): Promise<{ status: string }> {
    const stop = await this.ownStop(stopId, actor);
    await this.stateMachine.transition({ entity: 'route_stop', id: stopId, from: stop.status, to: 'EN_ROUTE', actorId: actor.userId });
    await this.db.current().routeStop.update({
      where: { id: stopId },
      data: { enRouteAt: new Date(input.occurredAt), gpsStatus: input.gpsStatus },
    });
    await this.audit.record({ action: 'field.stop.en-route', entityType: 'route_stop', entityId: stopId });
    return { status: 'EN_ROUTE' };
  }

  async markArrive(stopId: string, input: StopGpsEventRequest, actor: RequestUser): Promise<{ status: string }> {
    const tx = this.db.current();
    const stop = await this.ownStop(stopId, actor);
    await this.stateMachine.transition({ entity: 'route_stop', id: stopId, from: stop.status, to: 'ARRIVED', actorId: actor.userId });

    let distanceFromLocationM: number | null = null;
    if (input.lat != null && input.lng != null) {
      const service = await tx.service.findFirst({ where: { id: stop.serviceId }, include: { serviceLocation: true } });
      const loc = service?.serviceLocation;
      if (loc?.lat != null && loc.lng != null) {
        distanceFromLocationM = Math.round(haversineMeters(input.lat, input.lng, Number(loc.lat), Number(loc.lng)));
      }
    }

    await tx.routeStop.update({
      where: { id: stopId },
      data: {
        arrivedAt: new Date(input.occurredAt),
        arrivalLat: input.lat ?? null,
        arrivalLng: input.lng ?? null,
        arrivalAccuracyM: input.accuracy ?? null,
        gpsStatus: input.gpsStatus,
        distanceFromLocationM, // R48: se registra y advierte, nunca bloquea — no hay radio configurado todavía (Fase 2)
      },
    });
    await this.audit.record({ action: 'field.stop.arrive', entityType: 'route_stop', entityId: stopId, after: { distanceFromLocationM } });
    return { status: 'ARRIVED' };
  }

  /** R9: el mínimo verificable server-side hoy es el tiempo transcurrido — el conteo de fotos FACADE llega con PR-207. */
  async markNoShow(stopId: string, input: StopOutcomeRequest, actor: RequestUser): Promise<{ status: string }> {
    return this.markStopOutcome(stopId, 'NO_SHOW', input, actor, true);
  }

  async markInaccessible(stopId: string, input: StopOutcomeRequest, actor: RequestUser): Promise<{ status: string }> {
    return this.markStopOutcome(stopId, 'INACCESSIBLE', input, actor, false);
  }

  private async markStopOutcome(
    stopId: string,
    to: 'NO_SHOW' | 'INACCESSIBLE',
    input: StopOutcomeRequest,
    actor: RequestUser,
    checkElapsed: boolean,
  ): Promise<{ status: string }> {
    const tx = this.db.current();
    const stop = await this.ownStop(stopId, actor);

    if (checkElapsed && stop.arrivedAt) {
      const elapsedMs = new Date(input.occurredAt).getTime() - stop.arrivedAt.getTime();
      if (elapsedMs < 5 * 60 * 1000) {
        throw httpApiError(
          'BUSINESS_RULE_VIOLATION',
          'Todavía no pasaron 5 minutos desde la llegada — no se puede marcar NO_SHOW (R9).',
          422,
        );
      }
    }

    await this.stateMachine.transition({ entity: 'route_stop', id: stopId, from: stop.status, to, actorId: actor.userId });
    await tx.routeStop.update({
      where: { id: stopId },
      data: { outcomeReason: input.reason, wastedTrip: true },
    });

    // §D.3: "* → RESCHEDULED" automático cuando un stop cierra NO_SHOW/INACCESSIBLE.
    const service = await tx.service.findFirst({ where: { id: stop.serviceId } });
    if (service && service.status !== 'RESCHEDULED') {
      await this.stateMachine.transition({ entity: 'service', id: service.id, from: service.status, to: 'RESCHEDULED', actorId: actor.userId });
    }

    await this.audit.record({ action: `field.stop.${to.toLowerCase()}`, entityType: 'route_stop', entityId: stopId, severity: 'WARNING', after: { reason: input.reason } });
    return { status: to };
  }

  // --- Sesión (R2, R3) ---

  async startSession(serviceId: string, input: StartSessionRequest, actor: RequestUser): Promise<ServiceSession> {
    const tx = this.db.current();

    const existingReplay = await tx.serviceSession.findFirst({ where: { clientEventId: input.clientEventId } });
    if (existingReplay) return toSession(existingReplay);

    const service = await tx.service.findFirst({ where: { id: serviceId } });
    if (!service) throw httpApiError('NOT_FOUND', 'Servicio no encontrado.', 404);

    const stop = await tx.routeStop.findFirst({
      where: { serviceId, status: { in: ['PENDING', 'EN_ROUTE', 'ARRIVED'] } },
      include: { route: true },
    });
    if (!stop) throw httpApiError('NOT_FOUND', 'No hay un stop activo para este servicio.', 404);
    // R2: solo el operario asignado a su route_stop, y solo si la ruta está PUBLISHED/IN_PROGRESS.
    if (stop.route.technicianId !== actor.userId) {
      throw httpApiError('SERVICE_NOT_ASSIGNED_TO_TECHNICIAN', 'Este servicio no está asignado a tu ruta (R2).', 403);
    }
    if (stop.route.status !== 'PUBLISHED' && stop.route.status !== 'IN_PROGRESS') {
      throw httpApiError('SERVICE_NOT_ASSIGNED_TO_TECHNICIAN', `La ruta está en ${stop.route.status}, no se puede iniciar el servicio (R2).`, 422);
    }

    // R3: índice único parcial en DB es la garantía real; este check da el error legible antes de pisar contra el constraint.
    const openSession = await tx.serviceSession.findFirst({ where: { technicianId: actor.userId, status: 'OPEN' } });
    if (openSession) {
      throw httpApiError('TECHNICIAN_ALREADY_HAS_OPEN_SESSION', 'Ya tenés una sesión abierta — cerrala antes de iniciar otra (R3).', 409);
    }

    const session = await tx.serviceSession.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        serviceId,
        routeStopId: stop.id,
        technicianId: actor.userId,
        status: 'OPEN',
        startedAt: new Date(input.occurredAt),
        startLat: input.lat ?? null,
        startLng: input.lng ?? null,
        startAccuracyM: input.accuracy ?? null,
        clientEventId: input.clientEventId,
      },
    });

    if (service.status === 'DISPATCHED') {
      await this.stateMachine.transition({ entity: 'service', id: service.id, from: 'DISPATCHED', to: 'IN_EXECUTION', actorId: actor.userId });
    }
    await this.stateMachine.transition({ entity: 'route_stop', id: stop.id, from: stop.status, to: 'IN_PROGRESS', actorId: actor.userId });
    if (stop.route.status === 'PUBLISHED') {
      await this.stateMachine.transition({ entity: 'route', id: stop.route.id, from: 'PUBLISHED', to: 'IN_PROGRESS', actorId: actor.userId });
    }

    await this.audit.record({ action: 'field.session.start', entityType: 'service_session', entityId: session.id, after: { serviceId } });
    return toSession(session);
  }

  async pauseSession(sessionId: string, input: SessionActionRequest, actor: RequestUser): Promise<ServiceSession> {
    const tx = this.db.current();
    const session = await this.ownOpenSession(sessionId, actor);
    const intervals = asIntervals(session.pausedIntervals);
    if (intervals.some((i) => i.resumedAt === null)) {
      throw httpApiError('BUSINESS_RULE_VIOLATION', 'La sesión ya está pausada.', 422);
    }
    intervals.push({ pausedAt: input.occurredAt, resumedAt: null });
    const updated = await tx.serviceSession.update({ where: { id: sessionId }, data: { pausedIntervals: intervals as unknown as Prisma.InputJsonValue } });
    return toSession(updated);
  }

  async resumeSession(sessionId: string, input: SessionActionRequest, actor: RequestUser): Promise<ServiceSession> {
    const tx = this.db.current();
    const session = await this.ownOpenSession(sessionId, actor);
    const intervals = asIntervals(session.pausedIntervals);
    const open = [...intervals].reverse().find((i) => i.resumedAt === null);
    if (!open) throw httpApiError('BUSINESS_RULE_VIOLATION', 'La sesión no está pausada.', 422);
    open.resumedAt = input.occurredAt;
    const updated = await tx.serviceSession.update({ where: { id: sessionId }, data: { pausedIntervals: intervals as unknown as Prisma.InputJsonValue } });
    return toSession(updated);
  }

  // --- Insumos (R16-R18) ---

  async createSupplyUsage(sessionId: string, input: CreateSupplyUsageRequest, actor: RequestUser): Promise<ServiceSupplyUsage> {
    const tx = this.db.current();
    const existingReplay = await tx.serviceSupplyUsage.findFirst({ where: { clientEventId: input.clientEventId } });
    if (existingReplay) return toSupplyUsage(existingReplay);

    const session = await this.ownOpenSession(sessionId, actor);

    const { movement, concentrateEquivalent } = await this.inventory.recordConsumption({
      technicianId: actor.userId,
      supplyId: input.supplyId,
      lotId: input.lotId ?? null,
      lotCode: input.lotCode ?? null,
      quantityApplied: input.quantityApplied,
      isDilutedMix: input.isDilutedMix,
      actor,
    });

    const usage = await tx.serviceSupplyUsage.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        serviceSessionId: session.id,
        supplyId: input.supplyId,
        lotId: movement.lotId ?? null,
        quantityApplied: input.quantityApplied,
        unit: input.unit,
        isDilutedMix: input.isDilutedMix,
        concentrateEquivalent,
        applicationMethod: input.applicationMethod,
        treatedAreaSqm: input.treatedAreaSqm ?? null,
        inventoryMovementId: BigInt(movement.id),
        clientEventId: input.clientEventId,
      },
    });
    await this.audit.record({ action: 'field.session.supply-usage', entityType: 'service_session', entityId: session.id, after: { supplyId: input.supplyId, concentrateEquivalent } });
    return toSupplyUsage(usage);
  }

  // --- Firma ---

  async setSignature(sessionId: string, input: SessionSignatureRequest, actor: RequestUser): Promise<ServiceSession> {
    const session = await this.ownOpenSession(sessionId, actor);
    const updated = await this.db.current().serviceSession.update({
      where: { id: session.id },
      data: {
        clientSignatureUrl: input.clientSignatureUrl ?? null,
        signerName: input.signerName ?? null,
        signerIdNumber: input.signerIdNumber ?? null,
        noSignatureReason: input.noSignatureReason ?? null,
      },
    });
    return toSession(updated);
  }

  // --- Pago (R24/R25) ---

  async createPayment(sessionId: string, input: SessionPaymentRequest, actor: RequestUser): Promise<Payment> {
    const tx = this.db.current();
    const session = await this.ownOpenSession(sessionId, actor);
    const service = await tx.service.findFirst({ where: { id: session.serviceId } });
    if (!service) throw httpApiError('NOT_FOUND', 'Servicio no encontrado.', 404);

    return this.cash.createPayment(
      {
        serviceId: service.id,
        customerId: service.customerId,
        amountCents: input.amountCents,
        currency: 'ARS',
        method: input.method,
        receiptUrl: input.receiptUrl ?? null,
        clientEventId: input.clientEventId,
      },
      actor,
    );
  }

  // --- Cierre (R4) ---

  async finishSession(sessionId: string, input: FinishSessionRequest, actor: RequestUser): Promise<FinishSessionResponse> {
    const tx = this.db.current();
    const session = await this.ownOpenSession(sessionId, actor);

    const missing = await this.checklistGaps(tx, session, input);
    if (missing.length > 0) {
      throw httpApiError(
        'SERVICE_CLOSURE_CHECKLIST_INCOMPLETE',
        `Faltan ${missing.length} ítem(s) del checklist de cierre (R4): ${missing.map((m) => m.message).join(' ')}`,
        422,
        missing,
      );
    }

    await this.stateMachine.transition({ entity: 'service_session', id: session.id, from: 'OPEN', to: 'CLOSED', actorId: actor.userId });
    const updatedSession = await tx.serviceSession.update({
      where: { id: session.id },
      data: {
        endedAt: new Date(input.occurredAt),
        closureChecklist: { paymentDecision: input.paymentDecision },
        technicianNotes: input.technicianNotes ?? null,
      },
    });

    const stop = await tx.routeStop.findFirst({ where: { id: session.routeStopId } });
    if (stop) {
      await this.stateMachine.transition({ entity: 'route_stop', id: stop.id, from: stop.status, to: 'DONE', actorId: actor.userId });
    }
    const service = await tx.service.findFirst({ where: { id: session.serviceId } });
    if (service && service.status === 'IN_EXECUTION') {
      await this.stateMachine.transition({ entity: 'service', id: service.id, from: 'IN_EXECUTION', to: 'PENDING_VALIDATION', actorId: actor.userId });
    }

    // Si no queda ningún stop activo, la ruta pasa a COMPLETED — cierre natural del día.
    if (stop) {
      const route = await tx.route.findFirst({ where: { id: stop.routeId } });
      const remaining = await tx.routeStop.count({
        where: { routeId: stop.routeId, status: { in: ['PENDING', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] } },
      });
      if (route && route.status === 'IN_PROGRESS' && remaining === 0) {
        await this.stateMachine.transition({ entity: 'route', id: route.id, from: 'IN_PROGRESS', to: 'COMPLETED', actorId: actor.userId });
        await tx.route.update({ where: { id: route.id }, data: { completedAt: new Date() } });
      }
    }

    await this.audit.record({ action: 'field.session.finish', entityType: 'service_session', entityId: session.id, after: { paymentDecision: input.paymentDecision } });
    return { session: toSession(updatedSession), serviceStatus: service?.status === 'IN_EXECUTION' ? 'PENDING_VALIDATION' : (service?.status ?? 'PENDING_VALIDATION') };
  }

  private async checklistGaps(
    tx: RequestTx,
    session: { id: string; serviceId: string; clientSignatureUrl: string | null; noSignatureReason: string | null },
    input: FinishSessionRequest,
  ): Promise<Array<{ code: 'SERVICE_CLOSURE_CHECKLIST_INCOMPLETE'; field: string; message: string }>> {
    const gaps: Array<{ code: 'SERVICE_CLOSURE_CHECKLIST_INCOMPLETE'; field: string; message: string }> = [];

    const [beforeCount, afterCount, supplyCount, paymentCount] = await Promise.all([
      tx.serviceEvidence.count({ where: { serviceSessionId: session.id, category: 'BEFORE' } }),
      tx.serviceEvidence.count({ where: { serviceSessionId: session.id, category: 'AFTER' } }),
      tx.serviceSupplyUsage.count({ where: { serviceSessionId: session.id } }),
      tx.payment.count({ where: { serviceId: session.serviceId, status: 'CONFIRMED' } }),
    ]);

    if (beforeCount === 0) gaps.push({ code: 'SERVICE_CLOSURE_CHECKLIST_INCOMPLETE', field: 'evidence', message: 'Falta al menos 1 foto ANTES.' });
    if (afterCount === 0) gaps.push({ code: 'SERVICE_CLOSURE_CHECKLIST_INCOMPLETE', field: 'evidence', message: 'Falta al menos 1 foto DESPUÉS.' });
    if (supplyCount === 0 && !input.technicianNotes) {
      gaps.push({
        code: 'SERVICE_CLOSURE_CHECKLIST_INCOMPLETE',
        field: 'supplies',
        message: 'Registrá al menos un insumo aplicado, o justificá en notas por qué no se aplicó producto.',
      });
    }
    if (input.paymentDecision === 'COLLECTED' && paymentCount === 0) {
      gaps.push({ code: 'SERVICE_CLOSURE_CHECKLIST_INCOMPLETE', field: 'payment', message: 'Marcaste "cobrado" pero no hay ningún pago registrado.' });
    }
    if (!session.clientSignatureUrl && !session.noSignatureReason) {
      gaps.push({ code: 'SERVICE_CLOSURE_CHECKLIST_INCOMPLETE', field: 'signature', message: 'Falta la firma del cliente o el motivo de su ausencia.' });
    }
    return gaps;
  }

  // --- Stock y caja del operario ---

  async getMyStock(actor: RequestUser): Promise<InventoryBalance[]> {
    return this.inventory.listInventory({}, actor);
  }

  async closeCash(input: FieldCashCloseRequest, actor: RequestUser): Promise<CashClosure> {
    const accountId = await this.cash.getOwnAccountId(actor);
    return this.cash.declareClosure(accountId, input, actor);
  }

  // --- Helpers de pertenencia ---

  private async ownStop(stopId: string, actor: RequestUser): Promise<{ id: string; serviceId: string; status: RouteStopStatusLike; arrivedAt: Date | null }> {
    const tx = this.db.current();
    const stop = await tx.routeStop.findFirst({ where: { id: stopId }, include: { route: true } });
    if (!stop || stop.route.technicianId !== actor.userId) {
      throw httpApiError('NOT_FOUND', 'Stop no encontrado.', 404);
    }
    return stop;
  }

  private async ownOpenSession(sessionId: string, actor: RequestUser): Promise<Awaited<ReturnType<RequestTx['serviceSession']['findFirstOrThrow']>>> {
    const session = await this.db.current().serviceSession.findFirst({ where: { id: sessionId } });
    if (!session || session.technicianId !== actor.userId) {
      throw httpApiError('NOT_FOUND', 'Sesión no encontrada.', 404);
    }
    if (session.status !== 'OPEN') {
      throw httpApiError('SESSION_ALREADY_CLOSED', 'Esta sesión ya está cerrada.', 409);
    }
    return session;
  }
}

type RouteStopStatusLike = 'PENDING' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'DONE' | 'NO_SHOW' | 'INACCESSIBLE' | 'SKIPPED' | 'CANCELLED';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface PausedInterval {
  pausedAt: string;
  resumedAt: string | null;
}

function asIntervals(json: unknown): PausedInterval[] {
  return Array.isArray(json) ? (json as PausedInterval[]) : [];
}

interface SessionRow {
  id: string;
  tenantId: string;
  serviceId: string;
  routeStopId: string;
  technicianId: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  startLat: unknown;
  startLng: unknown;
  startAccuracyM: unknown;
  endLat: unknown;
  endLng: unknown;
  endAccuracyM: unknown;
  pausedIntervals: unknown;
  closureChecklist: unknown;
  clientSignatureUrl: string | null;
  signerName: string | null;
  signerIdNumber: string | null;
  noSignatureReason: string | null;
  technicianNotes: string | null;
  reopenedCount: number;
  autoClosed: boolean;
}

function toSession(r: SessionRow): ServiceSession {
  return {
    id: r.id,
    tenantId: r.tenantId,
    serviceId: r.serviceId,
    routeStopId: r.routeStopId,
    technicianId: r.technicianId,
    status: r.status as ServiceSession['status'],
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt ? r.endedAt.toISOString() : null,
    startLat: r.startLat !== null ? Number(r.startLat) : null,
    startLng: r.startLng !== null ? Number(r.startLng) : null,
    startAccuracyM: r.startAccuracyM !== null ? Number(r.startAccuracyM) : null,
    endLat: r.endLat !== null ? Number(r.endLat) : null,
    endLng: r.endLng !== null ? Number(r.endLng) : null,
    endAccuracyM: r.endAccuracyM !== null ? Number(r.endAccuracyM) : null,
    pausedIntervals: asIntervals(r.pausedIntervals),
    closureChecklist: (r.closureChecklist as Record<string, unknown> | null) ?? null,
    clientSignatureUrl: r.clientSignatureUrl,
    signerName: r.signerName,
    signerIdNumber: r.signerIdNumber,
    noSignatureReason: r.noSignatureReason as ServiceSession['noSignatureReason'],
    technicianNotes: r.technicianNotes,
    reopenedCount: r.reopenedCount,
    autoClosed: r.autoClosed,
  };
}

interface SupplyUsageRow {
  id: string;
  tenantId: string;
  serviceSessionId: string;
  supplyId: string;
  lotId: string | null;
  quantityApplied: unknown;
  unit: string;
  isDilutedMix: boolean;
  concentrateEquivalent: unknown;
  applicationMethod: string;
  treatedAreaSqm: unknown;
  clientEventId: string;
}

function toSupplyUsage(r: SupplyUsageRow): ServiceSupplyUsage {
  return {
    id: r.id,
    tenantId: r.tenantId,
    serviceSessionId: r.serviceSessionId,
    supplyId: r.supplyId,
    lotId: r.lotId,
    quantityApplied: Number(r.quantityApplied),
    unit: r.unit as ServiceSupplyUsage['unit'],
    isDilutedMix: r.isDilutedMix,
    concentrateEquivalent: Number(r.concentrateEquivalent),
    applicationMethod: r.applicationMethod as ServiceSupplyUsage['applicationMethod'],
    treatedAreaSqm: r.treatedAreaSqm !== null ? Number(r.treatedAreaSqm) : null,
    clientEventId: r.clientEventId,
  };
}

interface RouteStopForField {
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
  service: {
    code: string;
    status: string;
    notesForTechnician: string | null;
    priority: string;
    customer: { legalName: string; tradeName: string | null };
    serviceLocation: { addressLine: string; lat: unknown; lng: unknown };
    serviceType: { name: string };
  };
}

function toFieldStop(r: RouteStopForField): FieldStop {
  return {
    id: r.id,
    tenantId: r.tenantId,
    routeId: r.routeId,
    serviceId: r.serviceId,
    sequence: r.sequence,
    status: r.status as FieldStop['status'],
    eta: r.eta ? r.eta.toISOString().slice(11, 19) : null,
    travelMinutes: r.travelMinutes,
    enRouteAt: r.enRouteAt ? r.enRouteAt.toISOString() : null,
    arrivedAt: r.arrivedAt ? r.arrivedAt.toISOString() : null,
    arrivalLat: r.arrivalLat !== null ? Number(r.arrivalLat) : null,
    arrivalLng: r.arrivalLng !== null ? Number(r.arrivalLng) : null,
    arrivalAccuracyM: r.arrivalAccuracyM !== null ? Number(r.arrivalAccuracyM) : null,
    gpsStatus: r.gpsStatus as FieldStop['gpsStatus'],
    distanceFromLocationM: r.distanceFromLocationM,
    outcomeReason: r.outcomeReason as FieldStop['outcomeReason'],
    wastedTrip: r.wastedTrip,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    location: {
      customerName: r.service.customer.tradeName ?? r.service.customer.legalName,
      addressLine: r.service.serviceLocation.addressLine,
      lat: r.service.serviceLocation.lat !== null ? Number(r.service.serviceLocation.lat) : null,
      lng: r.service.serviceLocation.lng !== null ? Number(r.service.serviceLocation.lng) : null,
    },
    serviceCode: r.service.code,
    serviceStatus: r.service.status,
    serviceTypeName: r.service.serviceType.name,
    notesForTechnician: r.service.notesForTechnician,
    priority: r.service.priority,
  };
}
