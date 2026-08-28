import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@fumibug/db';
import type {
  CreateInventoryMovementRequest,
  CreateSupplyRequest,
  InventoryBalance,
  InventoryListQuery,
  InventoryMovement,
  InventoryMovementListQuery,
  StockLocation,
  Supply,
  UpdateSupplyRequest,
} from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { httpApiError } from '../../common/http/api-response';
import { resolveReadScope } from '../../common/guards/permission.guard';
import type { RequestUser } from '../../common/tenant/request-context';
import type { RequestTx } from '../../common/tenant/prisma-tenant.extension';

/**
 * docs/spec/13-inventario-caja.md §N, docs/spec/09-reglas.md R16-R23.
 *
 * Catálogo, ubicaciones (depósito + una por operario, auto-provistas), saldo actual y
 * movimientos manuales admin (PURCHASE/TRANSFER/ADJUSTMENT/LOSS/RETURN/
 * EXPIRY_WRITE_OFF — ver `CreateInventoryMovementRequestSchema`, que a propósito NO
 * admite `CONSUMPTION` por esa vía). `CONSUMPTION` real (R16-R18/R20) nace únicamente
 * desde `recordConsumption()`, llamado por `FieldService` dentro de la sesión de
 * campo — nunca desde un alta manual del admin.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Catálogo ---

  async listSupplies(): Promise<Supply[]> {
    const rows = await this.db.current().supply.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(toSupply);
  }

  async createSupply(input: CreateSupplyRequest, actor: RequestUser): Promise<Supply> {
    const tx = this.db.current();
    const row = await tx.supply.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        sku: input.sku,
        name: input.name,
        category: input.category,
        activeIngredient: input.activeIngredient ?? null,
        concentration: input.concentration ?? null,
        registryAuthority: input.registryAuthority,
        registryNumber: input.registryNumber,
        purchaseUnit: input.purchaseUnit,
        applicationUnit: input.applicationUnit,
        dilutionRateMlPerL: input.dilutionRateMlPerL ?? null,
        dosePerSqm: input.dosePerSqm ?? null,
        reentryHours: input.reentryHours ?? null,
        msdsUrl: input.msdsUrl ?? null,
        unitCostCents: input.unitCostCents !== undefined && input.unitCostCents !== null ? BigInt(input.unitCostCents) : null,
        requiresLotTracking: input.requiresLotTracking,
        minStock: input.minStock ?? null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
    await this.audit.record({ action: 'supply.create', entityType: 'supply', entityId: row.id, after: { sku: row.sku, name: row.name } });
    return toSupply(row);
  }

  async updateSupply(id: string, input: UpdateSupplyRequest, actor: RequestUser): Promise<Supply> {
    const tx = this.db.current();
    const existing = await tx.supply.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Insumo no encontrado.', 404);

    const row = await tx.supply.update({
      where: { id },
      data: {
        updatedBy: actor.userId,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.activeIngredient !== undefined ? { activeIngredient: input.activeIngredient } : {}),
        ...(input.concentration !== undefined ? { concentration: input.concentration } : {}),
        ...(input.registryAuthority !== undefined ? { registryAuthority: input.registryAuthority } : {}),
        ...(input.registryNumber !== undefined ? { registryNumber: input.registryNumber } : {}),
        ...(input.purchaseUnit !== undefined ? { purchaseUnit: input.purchaseUnit } : {}),
        ...(input.applicationUnit !== undefined ? { applicationUnit: input.applicationUnit } : {}),
        ...(input.dilutionRateMlPerL !== undefined ? { dilutionRateMlPerL: input.dilutionRateMlPerL } : {}),
        ...(input.dosePerSqm !== undefined ? { dosePerSqm: input.dosePerSqm } : {}),
        ...(input.reentryHours !== undefined ? { reentryHours: input.reentryHours } : {}),
        ...(input.msdsUrl !== undefined ? { msdsUrl: input.msdsUrl } : {}),
        ...(input.unitCostCents !== undefined
          ? { unitCostCents: input.unitCostCents === null ? null : BigInt(input.unitCostCents) }
          : {}),
        ...(input.requiresLotTracking !== undefined ? { requiresLotTracking: input.requiresLotTracking } : {}),
        ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
      },
    });
    await this.audit.record({ action: 'supply.update', entityType: 'supply', entityId: id });
    return toSupply(row);
  }

  // --- Ubicaciones de stock ---

  /** Depósito central + una VEHICLE por cada operario activo del tenant — auto-provistas (§N.3). */
  async listStockLocations(actor: RequestUser): Promise<StockLocation[]> {
    const tx = this.db.current();
    await this.ensureWarehouse(tx, actor);

    const technicians = await tx.membership.findMany({
      where: { status: 'ACTIVE', role: { key: 'technician' } },
      include: { user: { select: { id: true, fullName: true, username: true, email: true } } },
    });
    for (const m of technicians) {
      await this.ensureVehicleLocation(tx, actor, m.user.id, m.user.fullName ?? m.user.username ?? m.user.email);
    }

    const rows = await tx.stockLocation.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
    return rows.map(toStockLocation);
  }

  // --- Saldo actual ---

  async listInventory(query: InventoryListQuery, actor: RequestUser): Promise<InventoryBalance[]> {
    const tx = this.db.current();
    const where: Record<string, unknown> = {};
    if (query.stockLocationId) where['stockLocationId'] = query.stockLocationId;
    if (query.supplyId) where['supplyId'] = query.supplyId;

    const scope = resolveReadScope(actor, 'inventory.read.own', 'inventory.read.tenant');
    if (scope === 'own') {
      const mine = await tx.stockLocation.findFirst({ where: { type: 'VEHICLE', technicianId: actor.userId } });
      // Todavía no tiene vehículo asignado (nadie visitó /admin/inventario ni le cargaron
      // stock todavía) — sin stock, no hay nada que listar. Un id inválido acá rompía
      // la query (Postgres no acepta '__none__' como UUID); [] es la respuesta correcta.
      if (!mine) return [];
      where['stockLocationId'] = mine.id;
    }

    const rows = await tx.inventory.findMany({
      where,
      include: { stockLocation: true, supply: true, lot: true },
      orderBy: [{ supply: { name: 'asc' } }],
    });
    return rows
      .filter((r) => Number(r.quantity) !== 0)
      .map((r) => ({
        stockLocationId: r.stockLocationId,
        stockLocationName: r.stockLocation.name,
        stockLocationType: r.stockLocation.type,
        supplyId: r.supplyId,
        supplyName: r.supply.name,
        supplySku: r.supply.sku,
        applicationUnit: r.supply.applicationUnit,
        lotId: r.lotId,
        lotCode: r.lot?.lotCode ?? null,
        quantity: Number(r.quantity),
        minStock: r.supply.minStock !== null ? Number(r.supply.minStock) : null,
        belowMinimum: r.supply.minStock !== null && Number(r.quantity) < Number(r.supply.minStock),
      }));
  }

  async listMovements(query: InventoryMovementListQuery): Promise<InventoryMovement[]> {
    const tx = this.db.current();
    const where: Record<string, unknown> = {};
    if (query.stockLocationId) where['stockLocationId'] = query.stockLocationId;
    if (query.supplyId) where['supplyId'] = query.supplyId;
    if (query.cursor) where['id'] = { lt: BigInt(query.cursor) };

    const rows = await tx.inventoryMovement.findMany({
      where,
      take: query.limit,
      orderBy: { id: 'desc' },
    });
    return rows.map(toMovement);
  }

  // --- Movimientos ---

  async createMovement(input: CreateInventoryMovementRequest, actor: RequestUser): Promise<InventoryMovement[]> {
    const tx = this.db.current();
    const supply = await tx.supply.findFirst({ where: { id: input.supplyId } });
    if (!supply) throw httpApiError('NOT_FOUND', 'Insumo no encontrado.', 404);

    if ((input.type === 'ADJUSTMENT' || input.type === 'LOSS' || input.type === 'EXPIRY_WRITE_OFF') && !input.reason) {
      throw httpApiError('INVENTORY_ADJUST_REASON_REQUIRED', `El motivo es obligatorio para un movimiento ${input.type} (R22).`, 422);
    }

    const lotId = await this.resolveLot(tx, actor.tenantId, input.supplyId, input.lotId ?? null, input.lotCode ?? null);
    const unitCostCents =
      input.unitCostCents !== undefined && input.unitCostCents !== null ? BigInt(input.unitCostCents) : null;
    const allowNegative = actor.permissions.includes('inventory.allow_negative');

    if (input.type === 'TRANSFER') {
      if (!input.fromStockLocationId || !input.toStockLocationId) {
        throw httpApiError('VALIDATION_ERROR', 'TRANSFER requiere fromStockLocationId y toStockLocationId.', 400);
      }
      const referenceId = randomUUID();
      const qty = Math.abs(input.quantity);
      const out = await this.applyDelta(tx, {
        stockLocationId: input.fromStockLocationId,
        supplyId: input.supplyId,
        lotId,
        delta: new Prisma.Decimal(qty).negated(),
        type: 'TRANSFER_OUT',
        referenceType: 'inventory.transfer',
        referenceId,
        reason: input.reason ?? null,
        unitCostCents,
        allowNegative,
        actor,
      });
      const into = await this.applyDelta(tx, {
        stockLocationId: input.toStockLocationId,
        supplyId: input.supplyId,
        lotId,
        delta: new Prisma.Decimal(qty),
        type: 'TRANSFER_IN',
        referenceType: 'inventory.transfer',
        referenceId,
        reason: input.reason ?? null,
        unitCostCents,
        allowNegative,
        actor,
      });
      await this.audit.record({
        action: 'inventory.transfer',
        entityType: 'supply',
        entityId: input.supplyId,
        after: { from: input.fromStockLocationId, to: input.toStockLocationId, quantity: qty },
      });
      return [toMovement(out), toMovement(into)];
    }

    if (!input.stockLocationId) {
      throw httpApiError('VALIDATION_ERROR', `${input.type} requiere stockLocationId.`, 400);
    }
    // R19: PURCHASE/RETURN siempre suman; LOSS/EXPIRY_WRITE_OFF siempre restan;
    // ADJUSTMENT usa el signo cargado (una corrección puede subir o bajar el saldo).
    const delta =
      input.type === 'PURCHASE' || input.type === 'RETURN'
        ? new Prisma.Decimal(Math.abs(input.quantity))
        : input.type === 'LOSS' || input.type === 'EXPIRY_WRITE_OFF'
          ? new Prisma.Decimal(Math.abs(input.quantity)).negated()
          : new Prisma.Decimal(input.quantity); // ADJUSTMENT

    const movement = await this.applyDelta(tx, {
      stockLocationId: input.stockLocationId,
      supplyId: input.supplyId,
      lotId,
      delta,
      type: input.type,
      referenceType: null,
      referenceId: null,
      reason: input.reason ?? null,
      unitCostCents,
      allowNegative,
      actor,
    });
    await this.audit.record({
      action: `inventory.${input.type.toLowerCase()}`,
      entityType: 'supply',
      entityId: input.supplyId,
      severity: input.type === 'ADJUSTMENT' || input.type === 'LOSS' ? 'WARNING' : 'INFO', // R22
      after: { stockLocationId: input.stockLocationId, delta: delta.toNumber(), reason: input.reason ?? null },
    });
    return [toMovement(movement)];
  }

  // --- Consumo en campo (R16-R18, R20) ---

  /**
   * Llamado desde FieldService, dentro de la misma transacción que crea el
   * `service_supply_usage` (R16: "nunca uno sin el otro"). R17: descuenta SIEMPRE del
   * vehículo del operario que ejecuta, nunca del depósito. R19: el consumo de campo
   * SIEMPRE se acepta aunque deje el saldo negativo — acá no hay `allowNegative`
   * condicional a un permiso, es la excepción que exige la regla.
   */
  async recordConsumption(params: {
    technicianId: string;
    supplyId: string;
    lotId: string | null;
    lotCode: string | null;
    quantityApplied: number;
    isDilutedMix: boolean;
    actor: RequestUser;
  }): Promise<{ movement: InventoryMovement; concentrateEquivalent: number }> {
    const tx = this.db.current();
    const supply = await tx.supply.findFirst({ where: { id: params.supplyId } });
    if (!supply) throw httpApiError('NOT_FOUND', 'Insumo no encontrado.', 404);

    // Auto-provisión perezosa: el operario puede ser el primero en tocar inventario
    // (nadie visitó /admin/inventario todavía) — el consumo de campo no puede quedar
    // bloqueado esperando que un admin dé de alta la ubicación primero.
    const existingVehicle = await tx.stockLocation.findFirst({ where: { type: 'VEHICLE', technicianId: params.technicianId } });
    let vehicleId: string;
    if (existingVehicle) {
      vehicleId = existingVehicle.id;
    } else {
      const tech = await tx.user.findFirst({ where: { id: params.technicianId }, select: { fullName: true, username: true, email: true } });
      const created = await this.ensureVehicleLocation(tx, params.actor, params.technicianId, tech?.fullName ?? tech?.username ?? tech?.email ?? 'operario');
      vehicleId = created.id;
    }

    const lotId = await this.resolveLot(tx, params.actor.tenantId, params.supplyId, params.lotId, params.lotCode);
    if (lotId) {
      const lot = await tx.supplyLot.findFirst({ where: { id: lotId } });
      if (lot?.expiresOn && lot.expiresOn < new Date()) {
        throw httpApiError('LOT_EXPIRED', `El lote ${lot.lotCode} está vencido — no se puede seleccionar para consumo nuevo (R20).`, 422);
      }
    }

    // R18: en modo mezcla, lo que se descuenta es el concentrado equivalente
    // (litros de mezcla × dilution_rate_ml_per_l / 1000), no el volumen de mezcla.
    const concentrateEquivalent =
      params.isDilutedMix && supply.dilutionRateMlPerL !== null
        ? params.quantityApplied * Number(supply.dilutionRateMlPerL) / 1000
        : params.quantityApplied;

    const movement = await this.applyDelta(tx, {
      stockLocationId: vehicleId,
      supplyId: params.supplyId,
      lotId,
      delta: new Prisma.Decimal(concentrateEquivalent).negated(),
      type: 'CONSUMPTION',
      referenceType: null,
      referenceId: null,
      reason: null,
      unitCostCents: null,
      allowNegative: true, // R19
      actor: params.actor,
    });
    return { movement: toMovement(movement), concentrateEquivalent };
  }

  // --- Helpers ---

  private async ensureWarehouse(tx: RequestTx, actor: RequestUser): Promise<{ id: string }> {
    const existing = await tx.stockLocation.findFirst({ where: { type: 'WAREHOUSE' } });
    if (existing) return existing;
    return tx.stockLocation.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        type: 'WAREHOUSE',
        name: 'Depósito central',
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
  }

  private async ensureVehicleLocation(tx: RequestTx, actor: RequestUser, technicianId: string, technicianName: string): Promise<{ id: string }> {
    const existing = await tx.stockLocation.findFirst({ where: { type: 'VEHICLE', technicianId } });
    if (existing) return existing;
    return tx.stockLocation.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        type: 'VEHICLE',
        name: `Camioneta — ${technicianName}`,
        technicianId,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
  }

  private async resolveLot(
    tx: RequestTx,
    tenantId: string,
    supplyId: string,
    lotId: string | null,
    lotCode: string | null,
  ): Promise<string | null> {
    if (lotId) {
      const lot = await tx.supplyLot.findFirst({ where: { id: lotId, supplyId } });
      if (!lot) throw httpApiError('NOT_FOUND', 'Lote no encontrado para ese insumo.', 404);
      return lot.id;
    }
    if (lotCode) {
      const existing = await tx.supplyLot.findFirst({ where: { supplyId, lotCode } });
      if (existing) return existing.id;
      const created = await tx.supplyLot.create({ data: { id: randomUUID(), tenantId, supplyId, lotCode } });
      return created.id;
    }
    return null;
  }

  /** R23: lock + actualización de la proyección en la misma transacción que el movimiento. */
  private async applyDelta(
    tx: RequestTx,
    params: {
      stockLocationId: string;
      supplyId: string;
      lotId: string | null;
      delta: InstanceType<typeof Prisma.Decimal>;
      type: InventoryMovement['type'];
      referenceType: string | null;
      referenceId: string | null;
      reason: string | null;
      unitCostCents: bigint | null;
      allowNegative: boolean;
      actor: RequestUser;
    },
  ): Promise<MovementRow> {
    const lotFilter = params.lotId === null ? Prisma.sql`lot_id IS NULL` : Prisma.sql`lot_id = ${params.lotId}::uuid`;
    const locked = await tx.$queryRaw<Array<{ id: string; quantity: string }>>(
      Prisma.sql`SELECT id, quantity FROM "inventory" WHERE stock_location_id = ${params.stockLocationId}::uuid AND supply_id = ${params.supplyId}::uuid AND ${lotFilter} FOR UPDATE`,
    );
    const current = locked[0] ? new Prisma.Decimal(locked[0].quantity) : new Prisma.Decimal(0);
    const next = current.plus(params.delta);
    const requiresAdjustment = next.isNegative();
    if (requiresAdjustment && !params.allowNegative) {
      throw httpApiError(
        'INVENTORY_WOULD_GO_NEGATIVE',
        `El movimiento dejaría el saldo en ${next.toString()} (R19). Pedí inventory.allow_negative si es intencional.`,
        422,
      );
    }

    if (locked[0]) {
      await tx.inventory.update({ where: { id: locked[0].id }, data: { quantity: next } });
    } else {
      await tx.inventory.create({
        data: {
          id: randomUUID(),
          tenantId: params.actor.tenantId,
          stockLocationId: params.stockLocationId,
          supplyId: params.supplyId,
          lotId: params.lotId,
          quantity: next,
        },
      });
    }

    return tx.inventoryMovement.create({
      data: {
        tenantId: params.actor.tenantId,
        stockLocationId: params.stockLocationId,
        supplyId: params.supplyId,
        lotId: params.lotId,
        quantityDelta: params.delta,
        type: params.type,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        reason: params.reason,
        unitCostCents: params.unitCostCents,
        requiresAdjustment,
        performedBy: params.actor.userId,
      },
    });
  }
}

interface SupplyRow {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  category: string;
  activeIngredient: string | null;
  concentration: string | null;
  registryAuthority: string;
  registryNumber: string;
  purchaseUnit: string;
  applicationUnit: string;
  dilutionRateMlPerL: unknown;
  dosePerSqm: unknown;
  reentryHours: number | null;
  msdsUrl: string | null;
  unitCostCents: bigint | null;
  requiresLotTracking: boolean;
  minStock: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function toSupply(r: SupplyRow): Supply {
  return {
    id: r.id,
    tenantId: r.tenantId,
    sku: r.sku,
    name: r.name,
    category: r.category as Supply['category'],
    activeIngredient: r.activeIngredient,
    concentration: r.concentration,
    registryAuthority: r.registryAuthority as Supply['registryAuthority'],
    registryNumber: r.registryNumber,
    purchaseUnit: r.purchaseUnit as Supply['purchaseUnit'],
    applicationUnit: r.applicationUnit as Supply['applicationUnit'],
    dilutionRateMlPerL: r.dilutionRateMlPerL !== null ? Number(r.dilutionRateMlPerL) : null,
    dosePerSqm: r.dosePerSqm !== null ? Number(r.dosePerSqm) : null,
    reentryHours: r.reentryHours,
    msdsUrl: r.msdsUrl,
    unitCostCents: r.unitCostCents !== null ? Number(r.unitCostCents) : null,
    requiresLotTracking: r.requiresLotTracking,
    minStock: r.minStock !== null ? Number(r.minStock) : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

interface StockLocationRow {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  technicianId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toStockLocation(r: StockLocationRow): StockLocation {
  return {
    id: r.id,
    tenantId: r.tenantId,
    type: r.type as StockLocation['type'],
    name: r.name,
    technicianId: r.technicianId,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

interface MovementRow {
  id: bigint;
  tenantId: string;
  stockLocationId: string;
  supplyId: string;
  lotId: string | null;
  quantityDelta: unknown;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  unitCostCents: bigint | null;
  requiresAdjustment: boolean;
  performedBy: string | null;
  createdAt: Date;
}

function toMovement(r: MovementRow): InventoryMovement {
  return {
    id: r.id.toString(),
    tenantId: r.tenantId,
    stockLocationId: r.stockLocationId,
    supplyId: r.supplyId,
    lotId: r.lotId,
    quantityDelta: Number(r.quantityDelta),
    type: r.type as InventoryMovement['type'],
    referenceType: r.referenceType,
    referenceId: r.referenceId,
    reason: r.reason,
    unitCostCents: r.unitCostCents !== null ? Number(r.unitCostCents) : null,
    requiresAdjustment: r.requiresAdjustment,
    performedBy: r.performedBy,
    createdAt: r.createdAt.toISOString(),
  };
}
