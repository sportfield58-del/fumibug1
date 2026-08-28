import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CashAccount,
  CashClosure,
  CashClosureListQuery,
  CashMovement,
  CashMovementListQuery,
  CreateCashMovementRequest,
  CreatePaymentRequest,
  DeclareCashClosureRequest,
  Payment,
  PaymentListQuery,
  ReconcileCashClosureRequest,
  VoidPaymentRequest,
} from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StateMachineService } from '../../common/state-machine/state-machine.service';
import { httpApiError } from '../../common/http/api-response';
import { resolveReadScope } from '../../common/guards/permission.guard';
import type { RequestUser } from '../../common/tenant/request-context';
import type { RequestTx } from '../../common/tenant/prisma-tenant.extension';

/**
 * docs/spec/13-inventario-caja.md §O, docs/spec/09-reglas.md R24-R31.
 *
 * "Contabilidad de partida simple, append-only, sin edición. Cada peso que entra o
 * sale es un asiento inmutable." `cash_movements` tiene trigger que rechaza
 * UPDATE/DELETE (R42) — por eso todo lo que "cambiaría" un movimiento (voidPayment,
 * reconcile) se resuelve creando un asiento inverso nuevo, nunca tocando el original.
 * `CashClosure` sí se puede actualizar (no está en la lista de append-only), sus
 * transiciones pasan por StateMachineService (entity 'cash_closure', §D.7).
 */
@Injectable()
export class CashService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly stateMachine: StateMachineService,
  ) {}

  // --- Cajas ---

  /** Una cuenta TECHNICIAN por operario activo del tenant — auto-provistas (ver nota en ensureAccount). */
  async listCashAccounts(actor: RequestUser): Promise<CashAccount[]> {
    const tx = this.db.current();
    const technicians = await tx.membership.findMany({
      where: { status: 'ACTIVE', role: { key: 'technician' } },
      include: { user: { select: { id: true, fullName: true, username: true, email: true } } },
    });
    for (const m of technicians) {
      await this.ensureAccount(tx, actor, m.user.id, 'TECHNICIAN');
    }

    const scope = resolveReadScope(actor, 'cash.read.own', 'cash.read.tenant');
    const where: Record<string, unknown> = scope === 'own' ? { ownerUserId: actor.userId } : {};

    const rows = await tx.cashAccount.findMany({
      where,
      include: { owner: { select: { fullName: true, username: true, email: true } } },
      orderBy: { type: 'asc' },
    });

    const result: CashAccount[] = [];
    for (const r of rows) {
      const [sum, openClosure] = await Promise.all([
        tx.cashMovement.aggregate({ where: { cashAccountId: r.id }, _sum: { amountCents: true } }),
        tx.cashClosure.findFirst({ where: { cashAccountId: r.id, status: { in: ['OPEN', 'DECLARED', 'DISPUTED'] } } }),
      ]);
      result.push({
        id: r.id,
        tenantId: r.tenantId,
        ownerUserId: r.ownerUserId,
        ownerName: r.owner.fullName ?? r.owner.username ?? r.owner.email,
        type: r.type,
        currency: r.currency,
        isActive: r.isActive,
        balanceCents: Number(sum._sum.amountCents ?? 0n),
        openClosureId: openClosure?.id ?? null,
      });
    }
    return result;
  }

  async listMovements(accountId: string, query: CashMovementListQuery, actor: RequestUser): Promise<CashMovement[]> {
    const tx = this.db.current();
    const account = await this.assertAccountVisible(tx, accountId, actor);
    const where: Record<string, unknown> = { cashAccountId: account.id };
    if (query.cursor) where['id'] = { lt: BigInt(query.cursor) };
    const rows = await tx.cashMovement.findMany({ where, take: query.limit, orderBy: { id: 'desc' } });
    return rows.map(toCashMovement);
  }

  async createMovement(accountId: string, input: CreateCashMovementRequest, actor: RequestUser): Promise<CashMovement> {
    const tx = this.db.current();
    const account = await this.assertAccountVisible(tx, accountId, actor);
    const closure = await this.ensureOpenClosure(tx, account.id, actor);
    const movement = await tx.cashMovement.create({
      data: {
        tenantId: actor.tenantId,
        cashAccountId: account.id,
        amountCents: BigInt(input.amountCents),
        type: input.type,
        description: input.description,
        closureId: closure.id,
        performedBy: actor.userId,
      },
    });
    await this.audit.record({
      action: `cash.${input.type.toLowerCase()}`,
      entityType: 'cash_account',
      entityId: account.id,
      severity: input.type === 'ADJUSTMENT' ? 'WARNING' : 'INFO',
      after: { amountCents: input.amountCents, description: input.description },
    });
    return toCashMovement(movement);
  }

  // --- Pagos ---

  async listPayments(query: PaymentListQuery, actor: RequestUser): Promise<Payment[]> {
    const tx = this.db.current();
    const where: Record<string, unknown> = {};
    if (query.serviceId) where['serviceId'] = query.serviceId;
    if (query.customerId) where['customerId'] = query.customerId;
    if (query.method) where['method'] = query.method;
    const scope = resolveReadScope(actor, 'payment.read.own', 'payment.read.tenant');
    if (scope === 'own') where['receivedBy'] = actor.userId;

    const rows = await tx.payment.findMany({
      where,
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toPayment);
  }

  /** R24: pago en efectivo + cash_movement nacen en la misma transacción, sin excepción. R25: transferencia no toca la caja del operario. */
  async createPayment(input: CreatePaymentRequest, actor: RequestUser): Promise<Payment> {
    const tx = this.db.current();
    const payment = await tx.payment.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        serviceId: input.serviceId ?? null,
        customerId: input.customerId,
        amountCents: BigInt(input.amountCents),
        currency: input.currency,
        method: input.method,
        status: 'CONFIRMED',
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        receivedBy: actor.userId,
        receiptUrl: input.receiptUrl ?? null,
        clientEventId: input.clientEventId ?? null,
      },
    });

    if (input.method === 'CASH') {
      const account = await this.ensureAccount(tx, actor, actor.userId, 'TECHNICIAN');
      const closure = await this.ensureOpenClosure(tx, account.id, actor);
      await tx.cashMovement.create({
        data: {
          tenantId: actor.tenantId,
          cashAccountId: account.id,
          amountCents: payment.amountCents,
          type: 'SERVICE_PAYMENT',
          referenceType: 'payment',
          referenceId: payment.id,
          paymentId: payment.id,
          closureId: closure.id,
          performedBy: actor.userId,
        },
      });
    }

    await this.audit.record({
      action: 'payment.create',
      entityType: 'payment',
      entityId: payment.id,
      after: { amountCents: input.amountCents, method: input.method, customerId: input.customerId },
    });
    return toPayment(payment);
  }

  /** R26: no se edita, se anula con un asiento inverso. */
  async voidPayment(id: string, input: VoidPaymentRequest, actor: RequestUser): Promise<Payment> {
    const tx = this.db.current();
    const existing = await tx.payment.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Pago no encontrado.', 404);
    if (existing.status === 'VOIDED') {
      throw httpApiError('PAYMENT_ALREADY_VOIDED', 'Este pago ya está anulado.', 422);
    }

    const updated = await tx.payment.update({
      where: { id },
      data: { status: 'VOIDED', voidReason: input.reason },
    });

    if (existing.method === 'CASH') {
      const originalMovement = await tx.cashMovement.findFirst({ where: { paymentId: id, type: 'SERVICE_PAYMENT' } });
      if (originalMovement) {
        const closure = await this.ensureOpenClosure(tx, originalMovement.cashAccountId, actor);
        await tx.cashMovement.create({
          data: {
            tenantId: actor.tenantId,
            cashAccountId: originalMovement.cashAccountId,
            amountCents: -originalMovement.amountCents,
            type: 'REVERSAL',
            referenceType: 'payment',
            referenceId: id,
            paymentId: id,
            reversalOfId: originalMovement.id,
            closureId: closure.id,
            performedBy: actor.userId,
          },
        });
      }
    }

    await this.audit.record({
      action: 'payment.void',
      entityType: 'payment',
      entityId: id,
      severity: 'WARNING',
      before: { status: existing.status },
      after: { status: 'VOIDED', reason: input.reason },
    });
    return toPayment(updated);
  }

  // --- Rendiciones ---

  async listClosures(query: CashClosureListQuery): Promise<CashClosure[]> {
    const tx = this.db.current();
    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status;
    const rows = await tx.cashClosure.findMany({
      where,
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toCashClosure);
  }

  /** R27/R28: el operario declara lo que rinde; lo esperado se calcula de los movimientos del período abierto. */
  async declareClosure(accountId: string, input: DeclareCashClosureRequest, actor: RequestUser): Promise<CashClosure> {
    const tx = this.db.current();
    const account = await this.assertAccountVisible(tx, accountId, actor);
    const closure = await this.ensureOpenClosure(tx, account.id, actor);

    const sum = await tx.cashMovement.aggregate({ where: { closureId: closure.id }, _sum: { amountCents: true } });
    const expectedCents = sum._sum.amountCents ?? 0n;

    await this.stateMachine.transition({
      entity: 'cash_closure',
      id: closure.id,
      from: 'OPEN',
      to: 'DECLARED',
      actorId: actor.userId,
    });
    const updated = await tx.cashClosure.update({
      where: { id: closure.id },
      data: {
        periodEnd: new Date(),
        expectedCents,
        declaredCents: BigInt(input.declaredCents),
        declaredBy: actor.userId,
        declaredAt: new Date(),
      },
    });
    await this.audit.record({
      action: 'cash.closure.declare',
      entityType: 'cash_closure',
      entityId: closure.id,
      after: { expectedCents: expectedCents.toString(), declaredCents: input.declaredCents },
    });
    return toCashClosure(updated);
  }

  /** R28/R29: el admin cuenta y concilia — la diferencia siempre se absorbe con un ADJUSTMENT explícito. */
  async reconcileClosure(id: string, input: ReconcileCashClosureRequest, actor: RequestUser): Promise<CashClosure> {
    const tx = this.db.current();
    const closure = await tx.cashClosure.findFirst({ where: { id } });
    if (!closure) throw httpApiError('NOT_FOUND', 'Rendición no encontrada.', 404);
    if (closure.status !== 'DECLARED' && closure.status !== 'DISPUTED') {
      throw httpApiError('STATE_CONFLICT', `La rendición está en ${closure.status}, no se puede conciliar.`, 409);
    }

    const expected = closure.expectedCents ?? 0n;
    const received = BigInt(input.receivedCents);
    const differenceCents = expected - received;
    if (differenceCents !== 0n && !input.differenceReason) {
      throw httpApiError(
        'CASH_DIFFERENCE_REQUIRES_APPROVAL',
        `Hay una diferencia de ${differenceCents.toString()} centavos: hace falta un motivo escrito (R28).`,
        422,
      );
    }

    await tx.cashMovement.create({
      data: {
        tenantId: actor.tenantId,
        cashAccountId: closure.cashAccountId,
        amountCents: -received,
        type: 'HANDOVER',
        closureId: closure.id,
        performedBy: actor.userId,
        description: 'Entrega de efectivo al cierre de rendición.',
      },
    });
    if (differenceCents !== 0n) {
      // R29: deja el saldo en cero — nunca se arrastra un descuadre silencioso.
      await tx.cashMovement.create({
        data: {
          tenantId: actor.tenantId,
          cashAccountId: closure.cashAccountId,
          amountCents: -differenceCents,
          type: 'ADJUSTMENT',
          closureId: closure.id,
          performedBy: actor.userId,
          description: input.differenceReason ?? null,
        },
      });
    }

    await this.stateMachine.transition({
      entity: 'cash_closure',
      id: closure.id,
      from: closure.status,
      to: 'RECONCILED',
      actorId: actor.userId,
    });
    const selfApproved = actor.userId === closure.declaredBy;
    const updated = await tx.cashClosure.update({
      where: { id: closure.id },
      data: {
        receivedCents: received,
        differenceReason: input.differenceReason ?? null,
        approvedBy: actor.userId,
        approvedAt: new Date(),
        selfApproved,
      },
    });
    await this.audit.record({
      action: 'cash.closure.reconcile',
      entityType: 'cash_closure',
      entityId: closure.id,
      severity: differenceCents !== 0n ? 'WARNING' : 'INFO',
      after: { receivedCents: input.receivedCents, differenceCents: differenceCents.toString(), selfApproved },
    });
    return toCashClosure(updated);
  }

  // --- Helpers ---

  private async assertAccountVisible(tx: RequestTx, accountId: string, actor: RequestUser): Promise<{ id: string; ownerUserId: string }> {
    const account = await tx.cashAccount.findFirst({ where: { id: accountId } });
    if (!account) throw httpApiError('NOT_FOUND', 'Caja no encontrada.', 404);
    const scope = resolveReadScope(actor, 'cash.read.own', 'cash.read.tenant');
    if (scope === 'own' && account.ownerUserId !== actor.userId) {
      throw httpApiError('NOT_FOUND', 'Caja no encontrada.', 404); // R40: no distinguir de un 403
    }
    return account;
  }

  /**
   * `OFFICE` (la cuenta de la empresa donde caen las transferencias, R25) no se
   * auto-provisiona hoy: `ownerUserId` es NOT NULL y `@@unique([tenantId, ownerUserId,
   * currency])` implica una sola cuenta por persona — asignarle un dueño arbitrario
   * (¿qué admin?) es una decisión de negocio que no toca improvisar acá. R25 ya está
   * cubierto sin ella: un pago no-CASH simplemente no genera cash_movement.
   */
  private async ensureAccount(tx: RequestTx, actor: RequestUser, ownerUserId: string, type: 'TECHNICIAN'): Promise<{ id: string }> {
    const existing = await tx.cashAccount.findFirst({ where: { ownerUserId, currency: 'ARS' } });
    if (existing) return existing;
    return tx.cashAccount.create({
      data: { id: randomUUID(), tenantId: actor.tenantId, ownerUserId, type, currency: 'ARS' },
    });
  }

  /** Devuelve la rendición OPEN vigente de la caja, creando el período si no existe ninguna (§O.2). */
  private async ensureOpenClosure(tx: RequestTx, cashAccountId: string, actor: RequestUser): Promise<{ id: string }> {
    const existing = await tx.cashClosure.findFirst({ where: { cashAccountId, status: 'OPEN' } });
    if (existing) return existing;
    return tx.cashClosure.create({
      data: { id: randomUUID(), tenantId: actor.tenantId, cashAccountId, periodStart: new Date(), status: 'OPEN' },
    });
  }
}

interface PaymentRow {
  id: string;
  tenantId: string;
  serviceId: string | null;
  customerId: string;
  amountCents: bigint;
  currency: string;
  method: string;
  status: string;
  paidAt: Date;
  receivedBy: string;
  receiptUrl: string | null;
  varianceReason: string | null;
  reversalOfId: string | null;
  voidReason: string | null;
}

function toPayment(r: PaymentRow): Payment {
  return {
    id: r.id,
    tenantId: r.tenantId,
    serviceId: r.serviceId,
    customerId: r.customerId,
    amountCents: Number(r.amountCents),
    currency: r.currency,
    method: r.method as Payment['method'],
    status: r.status as Payment['status'],
    paidAt: r.paidAt.toISOString(),
    receivedBy: r.receivedBy,
    receiptUrl: r.receiptUrl,
    varianceReason: r.varianceReason as Payment['varianceReason'],
    reversalOfId: r.reversalOfId,
    voidReason: r.voidReason,
  };
}

interface CashMovementRow {
  id: bigint;
  tenantId: string;
  cashAccountId: string;
  amountCents: bigint;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
  closureId: string | null;
  description: string | null;
  performedBy: string | null;
  createdAt: Date;
}

function toCashMovement(r: CashMovementRow): CashMovement {
  return {
    id: r.id.toString(),
    tenantId: r.tenantId,
    cashAccountId: r.cashAccountId,
    amountCents: Number(r.amountCents),
    type: r.type as CashMovement['type'],
    referenceType: r.referenceType,
    referenceId: r.referenceId,
    closureId: r.closureId,
    description: r.description,
    performedBy: r.performedBy,
    createdAt: r.createdAt.toISOString(),
  };
}

interface CashClosureRow {
  id: string;
  tenantId: string;
  cashAccountId: string;
  periodStart: Date;
  periodEnd: Date | null;
  expectedCents: bigint | null;
  declaredCents: bigint | null;
  receivedCents: bigint | null;
  status: string;
  differenceReason: string | null;
  declaredBy: string | null;
  declaredAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  selfApproved: boolean;
}

function toCashClosure(r: CashClosureRow): CashClosure {
  return {
    id: r.id,
    tenantId: r.tenantId,
    cashAccountId: r.cashAccountId,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd ? r.periodEnd.toISOString() : null,
    expectedCents: r.expectedCents !== null ? Number(r.expectedCents) : null,
    declaredCents: r.declaredCents !== null ? Number(r.declaredCents) : null,
    receivedCents: r.receivedCents !== null ? Number(r.receivedCents) : null,
    status: r.status as CashClosure['status'],
    differenceReason: r.differenceReason,
    declaredBy: r.declaredBy,
    declaredAt: r.declaredAt ? r.declaredAt.toISOString() : null,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    selfApproved: r.selfApproved,
  };
}
