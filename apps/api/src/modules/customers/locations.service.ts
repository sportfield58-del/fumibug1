import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateLocationRequest,
  GeocodeLocationRequest,
  ServiceLocation,
  UpdateLocationRequest,
} from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { httpApiError } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import { GEOCODING_PROVIDER, type GeocodingProvider } from './geocoding.provider';

/**
 * docs/spec/03-modulos.md §C.4 / contracts/schemas/customer.ts (PR-102).
 *
 * `ServiceLocation` es tenant-scoped (§H.2): la extensión de Prisma (Capa 1) y RLS
 * (Capa 2) aislan por tenant. Un id de otro tenant no existe en la transacción → 404
 * (R40). El geocoding sigue ADR 0009: corrección manual ⇒ MANUAL, si no ⇒ provider
 * (OK/FAILED, sin reintentos en bucle por costo de §M.2).
 *
 * lat/lng y area_sqm en Prisma son `Decimal`, así que se pasan/leen como number
 * (Prisma convierte); sin escalado manual.
 */
@Injectable()
export class LocationsService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly audit: AuditService,
    @Inject(GEOCODING_PROVIDER) private readonly geocoder: GeocodingProvider,
  ) {}

  async listByCustomer(customerId: string): Promise<ServiceLocation[]> {
    await this.assertCustomerInTenant(customerId);
    const rows = await this.db.current().serviceLocation.findMany({
      where: { customerId, archivedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toServiceLocation);
  }

  async create(customerId: string, input: CreateLocationRequest, actor: RequestUser): Promise<ServiceLocation> {
    const tx = this.db.current();
    await this.assertCustomerInTenant(customerId);

    const { lat, lng, geocodeStatus } = await this.resolveCoordinates(input);

    const location = await tx.serviceLocation.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        customerId,
        label: input.label ?? null,
        addressLine: input.addressLine,
        city: input.city ?? null,
        province: input.province ?? null,
        postalCode: input.postalCode ?? null,
        lat,
        lng,
        geocodeStatus,
        accessNotes: input.accessNotes ?? null,
        hazardNotes: input.hazardNotes ?? null,
        establishmentType: input.establishmentType ?? 'OTHER',
        areaSqm: input.areaSqm ?? null,
        serviceWindowStart: input.serviceWindowStart ? parseTime(input.serviceWindowStart) : null,
        serviceWindowEnd: input.serviceWindowEnd ? parseTime(input.serviceWindowEnd) : null,
        zoneId: input.zoneId ?? null,
      },
    });

    await this.audit.record({
      action: 'location.create',
      entityType: 'service_location',
      entityId: location.id,
      severity: 'INFO',
      after: { customerId, addressLine: input.addressLine, geocodeStatus },
    });

    return toServiceLocation(location);
  }

  async getById(id: string): Promise<ServiceLocation> {
    const row = await this.db.current().serviceLocation.findFirst({ where: { id } });
    if (!row) throw httpApiError('NOT_FOUND', 'Ubicación no encontrada.', 404);
    return toServiceLocation(row);
  }

  async update(id: string, input: UpdateLocationRequest, ifMatch: string | null): Promise<ServiceLocation> {
    const tx = this.db.current();
    const existing = await tx.serviceLocation.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Ubicación no encontrada.', 404);

    const expectedEtag = `"${existing.updatedAt.toISOString()}"`;
    if (!ifMatch || ifMatch.trim() !== expectedEtag) {
      throw httpApiError('VERSION_CONFLICT', 'If-Match no coincide: actualizá tus datos.', 409);
    }

    await tx.serviceLocation.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.province !== undefined ? { province: input.province } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.lat !== undefined ? { lat: input.lat } : {}),
        ...(input.lng !== undefined ? { lng: input.lng } : {}),
        ...(input.accessNotes !== undefined ? { accessNotes: input.accessNotes } : {}),
        ...(input.hazardNotes !== undefined ? { hazardNotes: input.hazardNotes } : {}),
        ...(input.establishmentType !== undefined ? { establishmentType: input.establishmentType } : {}),
        ...(input.areaSqm !== undefined ? { areaSqm: input.areaSqm } : {}),
        ...(input.serviceWindowStart !== undefined
          ? { serviceWindowStart: input.serviceWindowStart ? parseTime(input.serviceWindowStart) : null }
          : {}),
        ...(input.serviceWindowEnd !== undefined
          ? { serviceWindowEnd: input.serviceWindowEnd ? parseTime(input.serviceWindowEnd) : null }
          : {}),
        ...(input.zoneId !== undefined ? { zoneId: input.zoneId } : {}),
      },
    });

    await this.audit.record({
      action: 'location.update',
      entityType: 'service_location',
      entityId: id,
      after: { addressLine: input.addressLine ?? undefined },
    });

    return this.getById(id);
  }

  async geocode(id: string, body: GeocodeLocationRequest): Promise<ServiceLocation> {
    const tx = this.db.current();
    const existing = await tx.serviceLocation.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Ubicación no encontrada.', 404);

    // ADR 0009: corrección manual del pin ⇒ se graba y MANUAL, sin llamar al proveedor.
    if (body.manualLat !== undefined || body.manualLng !== undefined) {
      const lat = body.manualLat !== undefined ? body.manualLat : toNumber(existing.lat);
      const lng = body.manualLng !== undefined ? body.manualLng : toNumber(existing.lng);
      await tx.serviceLocation.update({ where: { id }, data: { lat, lng, geocodeStatus: 'MANUAL' } });
      await this.audit.record({
        action: 'location.geocode-manual',
        entityType: 'service_location',
        entityId: id,
        severity: 'INFO',
        after: { geocodeStatus: 'MANUAL' },
      });
      return this.getById(id);
    }

    // Sin manual: consultar al proveedor. Sin proveedor/config → FAILED, nunca PENDING.
    const { lat, lng, status: geocodeStatus } = await this.geocoder.geocode(
      existing.addressLine,
      existing.city,
    );
    await tx.serviceLocation.update({
      where: { id },
      data: { lat, lng, geocodeStatus },
    });
    await this.audit.record({
      action: 'location.geocode',
      entityType: 'service_location',
      entityId: id,
      severity: 'INFO',
      after: { geocodeStatus },
    });

    return this.getById(id);
  }

  private async resolveCoordinates(
    input: CreateLocationRequest,
  ): Promise<{ lat: number | null; lng: number | null; geocodeStatus: ServiceLocation['geocodeStatus'] }> {
    // Alta con corrección manual en origen.
    if (input.lat !== undefined || input.lng !== undefined) {
      return {
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        geocodeStatus: 'MANUAL',
      };
    }
    // Sin coordenadas: geocodificar (costo de §M.2: al crear, persistido, sin bucle).
    const { lat, lng, status } = await this.geocoder.geocode(input.addressLine, input.city ?? null);
    return { lat, lng, geocodeStatus: status };
  }

  private async assertCustomerInTenant(customerId: string): Promise<void> {
    const found = await this.db.current().customer.findFirst({ where: { id: customerId }, select: { id: true } });
    if (!found) throw httpApiError('NOT_FOUND', 'Cliente no encontrado.', 404);
  }
}

interface ServiceLocationRow {
  id: string;
  tenantId: string;
  customerId: string;
  label: string | null;
  addressLine: string;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  lat: { toNumber(): number } | null;
  lng: { toNumber(): number } | null;
  geocodeStatus: string;
  accessNotes: string | null;
  hazardNotes: string | null;
  establishmentType: string;
  areaSqm: { toNumber(): number } | null;
  serviceWindowStart: Date | null;
  serviceWindowEnd: Date | null;
  zoneId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toNumber(v: { toNumber(): number } | null): number | null {
  return v !== null ? v.toNumber() : null;
}

function toServiceLocation(r: ServiceLocationRow): ServiceLocation {
  return {
    id: r.id,
    tenantId: r.tenantId,
    customerId: r.customerId,
    label: r.label,
    addressLine: r.addressLine,
    city: r.city,
    province: r.province,
    postalCode: r.postalCode,
    lat: toNumber(r.lat),
    lng: toNumber(r.lng),
    geocodeStatus: r.geocodeStatus as ServiceLocation['geocodeStatus'],
    accessNotes: r.accessNotes,
    hazardNotes: r.hazardNotes,
    establishmentType: r.establishmentType as ServiceLocation['establishmentType'],
    areaSqm: toNumber(r.areaSqm),
    serviceWindowStart: r.serviceWindowStart ? toTimeString(r.serviceWindowStart) : null,
    serviceWindowEnd: r.serviceWindowEnd ? toTimeString(r.serviceWindowEnd) : null,
    zoneId: r.zoneId,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toTimeString(d: Date): string {
  return d.toISOString().slice(11, 19);
}

function parseTime(value: string): Date {
  return new Date(`1970-01-01T${value}Z`);
}
