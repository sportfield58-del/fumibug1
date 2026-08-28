import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreatePriceListRequest,
  CreateServiceTypeRequest,
  CreateZoneRequest,
  EstablishmentType,
  PriceListWithItems,
  ServiceType,
  UpdatePriceListRequest,
  UpdateServiceTypeRequest,
  UpdateZoneRequest,
  Zone,
} from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { httpApiError } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import type { RequestTx } from '../../common/tenant/prisma-tenant.extension';

/**
 * docs/spec/03-modulos.md §C.19 (Configuración) / contracts/schemas/service-catalog.ts
 * (PR-103). Tipos de servicio, zonas y listas de precios.
 *
 * Las cuatro tablas son tenant-scoped (§H.2): la extensión de Prisma (Capa 1) y RLS
 * (Capa 2) aislan por tenant; un id de otro tenant no existe en la transacción → 404
 * (R40). Sobre los `create` hay que pasar `tenantId` explícito (tipo de Prisma);
 * sobre los `update` la protección la da RLS.
 *
 * Reglas de negocio (docs/spec/03-modulos.md §C.5, docs/spec/09-reglas.md):
 *  - La `key` de un tipo de servicio es única por tenant.
 *  - Las listas de precios no pueden solaparse en su rango de vigencia (el EXCLUDE
 *    constraint de Postgres la respalda; acá se valida para dar un 422 descriptivo).
 *  - Dinero en centavos (int) — nunca float (CLAUDE.md §4).
 */
@Injectable()
export class ServiceCatalogService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Tipos de servicio
  // ---------------------------------------------------------------------------

  async listServiceTypes(): Promise<ServiceType[]> {
    const rows = await this.db.current().serviceType.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    return rows.map(toServiceType);
  }

  async createServiceType(input: CreateServiceTypeRequest, actor: RequestUser): Promise<ServiceType> {
    const tx = this.db.current();
    const existing = await tx.serviceType.findFirst({ where: { key: input.key } });
    if (existing) {
      throw httpApiError('BUSINESS_RULE_VIOLATION', `Ya existe un tipo de servicio con la clave "${input.key}".`, 422);
    }

    const row = await tx.serviceType.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        key: input.key,
        name: input.name,
        defaultDurationMinutes: input.defaultDurationMinutes ?? null,
        // checklist configurable llega en Fase 2 (docs/spec/03-modulos.md §C.19) — hoy
        // solo se persiste vacío, CreateServiceTypeRequest no lo acepta como input.
        checklist: [],
        requiredSupplyIds: input.requiredSupplyIds ?? [],
        certificateTemplateKey: input.certificateTemplateKey ?? null,
      },
    });

    await this.audit.record({
      action: 'service-type.create',
      entityType: 'service_type',
      entityId: row.id,
      severity: 'INFO',
      after: { key: row.key, name: row.name },
    });

    return toServiceType(row);
  }

  async updateServiceType(id: string, input: UpdateServiceTypeRequest, ifMatch: string | null): Promise<ServiceType> {
    const tx = this.db.current();
    const existing = await tx.serviceType.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Tipo de servicio no encontrado.', 404);
    assertIfMatch(ifMatch, existing.updatedAt);

    await tx.serviceType.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.defaultDurationMinutes !== undefined ? { defaultDurationMinutes: input.defaultDurationMinutes } : {}),
        ...(input.requiredSupplyIds !== undefined ? { requiredSupplyIds: input.requiredSupplyIds } : {}),
        ...(input.certificateTemplateKey !== undefined
          ? { certificateTemplateKey: input.certificateTemplateKey }
          : {}),
      },
    });

    await this.audit.record({
      action: 'service-type.update',
      entityType: 'service_type',
      entityId: id,
      after: { name: input.name ?? undefined },
    });

    return this.getServiceType(id);
  }

  // ---------------------------------------------------------------------------
  // Zonas
  // ---------------------------------------------------------------------------

  async listZones(): Promise<Zone[]> {
    const rows = await this.db.current().zone.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    return rows.map(toZone);
  }

  async createZone(input: CreateZoneRequest, actor: RequestUser): Promise<Zone> {
    const row = await this.db.current().zone.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        name: input.name,
        color: input.color ?? null,
      },
    });

    await this.audit.record({
      action: 'zone.create',
      entityType: 'zone',
      entityId: row.id,
      severity: 'INFO',
      after: { name: row.name },
    });

    return toZone(row);
  }

  async updateZone(id: string, input: UpdateZoneRequest, ifMatch: string | null): Promise<Zone> {
    const tx = this.db.current();
    const existing = await tx.zone.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Zona no encontrada.', 404);
    assertIfMatch(ifMatch, existing.updatedAt);

    await tx.zone.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });

    await this.audit.record({
      action: 'zone.update',
      entityType: 'zone',
      entityId: id,
      after: { name: input.name ?? undefined },
    });

    return this.getZone(id);
  }

  // ---------------------------------------------------------------------------
  // Listas de precios (con items)
  // ---------------------------------------------------------------------------

  async listPriceLists(): Promise<PriceListWithItems[]> {
    const rows = await this.db.current().priceList.findMany({
      orderBy: [{ validFrom: 'desc' }, { id: 'asc' }],
      include: { items: true },
    });
    return rows.map(toPriceListWithItems);
  }

  async createPriceList(input: CreatePriceListRequest, actor: RequestUser): Promise<PriceListWithItems> {
    const tx = this.db.current();
    const validTo = input.validTo !== undefined ? (input.validTo !== null ? input.validTo : null) : null;
    await this.assertNoOverlap(tx, input.validFrom, validTo);

    const priceListId = randomUUID();
    await tx.priceList.create({
      data: {
        id: priceListId,
        tenantId: actor.tenantId,
        name: input.name,
        validFrom: parseDate(input.validFrom),
        validTo: validTo !== null ? parseDate(validTo) : null,
        isDefault: input.isDefault ?? false,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    for (const item of input.items ?? []) {
      await this.createItem(tx, priceListId, item, actor.tenantId);
    }

    await this.audit.record({
      action: 'price-list.create',
      entityType: 'price_list',
      entityId: priceListId,
      severity: 'INFO',
      after: { name: input.name, isDefault: input.isDefault ?? false },
    });

    return this.getPriceList(priceListId);
  }

  async updatePriceList(id: string, input: UpdatePriceListRequest, ifMatch: string | null): Promise<PriceListWithItems> {
    const tx = this.db.current();
    const existing = await tx.priceList.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Lista de precios no encontrada.', 404);
    assertIfMatch(ifMatch, existing.updatedAt);

    const validFrom = input.validFrom !== undefined ? input.validFrom : toDateString(existing.validFrom);
    const validTo =
      input.validTo !== undefined
        ? input.validTo !== null
          ? input.validTo
          : null
        : existing.validTo
          ? toDateString(existing.validTo)
          : null;
    await this.assertNoOverlap(tx, validFrom, validTo, id);

    await tx.priceList.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.validFrom !== undefined ? { validFrom: parseDate(input.validFrom) } : {}),
        ...(input.validTo !== undefined
          ? { validTo: input.validTo !== null ? parseDate(input.validTo) : null }
          : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });

    if (input.items !== undefined) {
      await tx.priceListItem.deleteMany({ where: { priceListId: id } });
      const tenantId = existing.tenantId;
      for (const item of input.items) {
        await this.createItem(tx, id, item, tenantId);
      }
    }

    await this.audit.record({
      action: 'price-list.update',
      entityType: 'price_list',
      entityId: id,
      after: { name: input.name ?? undefined },
    });

    return this.getPriceList(id);
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private async getServiceType(id: string): Promise<ServiceType> {
    const row = await this.db.current().serviceType.findFirst({ where: { id } });
    if (!row) throw httpApiError('NOT_FOUND', 'Tipo de servicio no encontrado.', 404);
    return toServiceType(row);
  }

  private async getZone(id: string): Promise<Zone> {
    const row = await this.db.current().zone.findFirst({ where: { id } });
    if (!row) throw httpApiError('NOT_FOUND', 'Zona no encontrada.', 404);
    return toZone(row);
  }

  private async getPriceList(id: string): Promise<PriceListWithItems> {
    const row = await this.db.current().priceList.findFirst({ where: { id }, include: { items: true } });
    if (!row) throw httpApiError('NOT_FOUND', 'Lista de precios no encontrada.', 404);
    return toPriceListWithItems(row);
  }

  private async createItem(
    tx: RequestTx,
    priceListId: string,
    item: CreatePriceListRequest['items'][number],
    tenantId: string,
  ): Promise<void> {
    await tx.priceListItem.create({
      data: {
        id: randomUUID(),
        tenantId,
        priceListId,
        serviceTypeId: item.serviceTypeId,
        establishmentType: item.establishmentType ?? null,
        priceCents: BigInt(item.priceCents),
        pricePerSqmCents: item.pricePerSqmCents != null ? BigInt(item.pricePerSqmCents) : null,
      },
    });
  }

  private async assertNoOverlap(
    tx: RequestTx,
    validFrom: string,
    validTo: string | null,
    excludeId?: string,
  ): Promise<void> {
    const from = parseDate(validFrom);
    const to = validTo !== null ? parseDate(validTo) : null;
    const all = await tx.priceList.findMany({ select: { id: true, validFrom: true, validTo: true } });
    for (const l of all) {
      if (l.id === excludeId) continue;
      if (rangesOverlap(from, to, l.validFrom, l.validTo)) {
        throw httpApiError('BUSINESS_RULE_VIOLATION', 'La vigencia de la lista se solapa con otra existente.', 422);
      }
    }
  }
}

function assertIfMatch(ifMatch: string | null, updatedAt: Date): void {
  const expectedEtag = `"${updatedAt.toISOString()}"`;
  if (!ifMatch || ifMatch.trim() !== expectedEtag) {
    throw httpApiError('VERSION_CONFLICT', 'If-Match no coincide: actualizá tus datos.', 409);
  }
}

function rangesOverlap(aFrom: Date, aTo: Date | null, bFrom: Date, bTo: Date | null): boolean {
  const aEnd = aTo ?? new Date(8640000000000000);
  const bEnd = bTo ?? new Date(8640000000000000);
  return aFrom < bEnd && bFrom < aEnd;
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface ServiceTypeRow {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  defaultDurationMinutes: number | null;
  checklist: unknown;
  requiredSupplyIds: string[];
  certificateTemplateKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toServiceType(r: ServiceTypeRow): ServiceType {
  return {
    id: r.id,
    tenantId: r.tenantId,
    key: r.key,
    name: r.name,
    defaultDurationMinutes: r.defaultDurationMinutes,
    checklist: Array.isArray(r.checklist) ? r.checklist : [],
    requiredSupplyIds: r.requiredSupplyIds,
    certificateTemplateKey: r.certificateTemplateKey,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

interface ZoneRow {
  id: string;
  tenantId: string;
  name: string;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toZone(r: ZoneRow): Zone {
  return {
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    color: r.color,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

interface PriceListItemRow {
  id: string;
  tenantId: string;
  priceListId: string;
  serviceTypeId: string;
  establishmentType: EstablishmentType | null;
  priceCents: bigint;
  pricePerSqmCents: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PriceListRow {
  id: string;
  tenantId: string;
  name: string;
  validFrom: Date;
  validTo: Date | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  items: PriceListItemRow[];
}

function toPriceListWithItems(r: PriceListRow): PriceListWithItems {
  return {
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    validFrom: toDateString(r.validFrom),
    validTo: r.validTo ? toDateString(r.validTo) : null,
    isDefault: r.isDefault,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    items: r.items.map((i) => ({
      id: i.id,
      tenantId: i.tenantId,
      priceListId: i.priceListId,
      serviceTypeId: i.serviceTypeId,
      establishmentType: i.establishmentType,
      priceCents: Number(i.priceCents),
      pricePerSqmCents: i.pricePerSqmCents !== null ? Number(i.pricePerSqmCents) : null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
  };
}
