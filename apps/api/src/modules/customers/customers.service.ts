import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateCustomerRequest,
  CustomerListQuery,
  CustomerSummaryResponse,
  CustomerWithContacts,
  UpdateCustomerRequest,
} from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { httpApiError } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';

/**
 * docs/spec/03-modulos.md §C.3 / contracts/schemas/customer.ts (PR-102).
 *
 * `Customer`/`CustomerContact` son tablas tenant-scoped (§H.1, §H.2): a diferencia de
 * `users` (tabla global sin RLS), acá la Capa 1 de aislamiento (extensión de Prisma)
 * inyecta `tenantId` solo en las queries de filtro y crea, y la Capa 2 (RLS) protege
 * las de clave única. Por eso no hay aislamiento manual por membership como en users:
 * un id de otro tenant simplemente no existe en la transacción → 404 (R40).
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: CustomerListQuery): Promise<CustomerWithContacts[]> {
    const tx = this.db.current();
    const limit = query.limit ?? 20;

    const rows = await tx.customer.findMany({
      where: {
        ...(query.type !== undefined ? { type: query.type } : {}),
        ...(query.includeArchived ? {} : { archivedAt: null }),
        ...(query.search
          ? {
              OR: [
                { legalName: { contains: query.search, mode: 'insensitive' } },
                { tradeName: { contains: query.search, mode: 'insensitive' } },
                { taxId: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.cursor ? this.cursorWhere(query.cursor) : {}),
      },
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { contacts: true },
    });

    return rows.map(toCustomerWithContacts);
  }

  async create(input: CreateCustomerRequest, actor: RequestUser): Promise<CustomerWithContacts> {
    const tx = this.db.current();
    const customerId = randomUUID();

    await tx.customer.create({
      data: {
        id: customerId,
        tenantId: actor.tenantId,
        type: input.type,
        legalName: input.legalName,
        tradeName: input.tradeName ?? null,
        taxId: input.taxId ?? null,
        taxCondition: input.taxCondition ?? null,
        paymentTerms: input.paymentTerms ?? 'CASH',
        creditLimitCents:
          input.creditLimitCents !== undefined && input.creditLimitCents !== null
            ? BigInt(input.creditLimitCents)
            : null,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    for (const c of input.contacts ?? []) {
      await tx.customerContact.create({
        data: {
          tenantId: actor.tenantId,
          customerId,
          name: c.name,
          role: c.role,
          phone: c.phone ?? null,
          email: c.email ?? null,
          isPrimary: c.isPrimary ?? false,
        },
      });
    }

    await this.audit.record({
      action: 'customer.create',
      entityType: 'customer',
      entityId: customerId,
      severity: 'INFO',
      after: { type: input.type, legalName: input.legalName },
    });

    return this.getById(customerId);
  }

  async getById(id: string): Promise<CustomerWithContacts> {
    const customer = await this.db.current().customer.findFirst({
      where: { id },
      include: { contacts: true },
    });
    if (!customer) throw httpApiError('NOT_FOUND', 'Cliente no encontrado.', 404);
    return toCustomerWithContacts(customer);
  }

  async update(
    id: string,
    input: UpdateCustomerRequest,
    ifMatch: string | null,
    actor: RequestUser,
  ): Promise<CustomerWithContacts> {
    const tx = this.db.current();
    const existing = await tx.customer.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Cliente no encontrado.', 404);

    const expectedEtag = `"${existing.updatedAt.toISOString()}"`;
    if (!ifMatch || ifMatch.trim() !== expectedEtag) {
      throw httpApiError('VERSION_CONFLICT', 'If-Match no coincide: actualizá tus datos.', 409);
    }

    await tx.customer.update({
      where: { id },
      data: {
        ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.tradeName !== undefined ? { tradeName: input.tradeName } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
        ...(input.taxCondition !== undefined ? { taxCondition: input.taxCondition } : {}),
        ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms } : {}),
        ...(input.creditLimitCents !== undefined
          ? { creditLimitCents: input.creditLimitCents !== null ? BigInt(input.creditLimitCents) : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        updatedBy: actor.userId,
      },
    });

    // Contactos embebidos: la edición reemplaza la lista completa (contracts §C.3).
    if (input.contacts) {
      await this.replaceContacts(id, input.contacts, actor);
    }

    await this.audit.record({
      action: 'customer.update',
      entityType: 'customer',
      entityId: id,
      before: { legalName: existing.legalName },
      after: { legalName: input.legalName ?? undefined },
    });

    return this.getById(id);
  }

  async archive(id: string, actor: RequestUser): Promise<CustomerWithContacts> {
    const tx = this.db.current();
    const existing = await tx.customer.findFirst({ where: { id } });
    if (!existing) throw httpApiError('NOT_FOUND', 'Cliente no encontrado.', 404);
    if (existing.archivedAt) {
      throw httpApiError('STATE_CONFLICT', 'El cliente ya está archivado.', 409);
    }

    await tx.customer.update({
      where: { id },
      data: { archivedAt: new Date(), updatedBy: actor.userId },
    });

    await this.audit.record({
      action: 'customer.archive',
      entityType: 'customer',
      entityId: id,
      severity: 'INFO',
      after: { archivedAt: new Date().toISOString() },
    });

    return this.getById(id);
  }

  async getSummary(id: string): Promise<CustomerSummaryResponse> {
    const tx = this.db.current();
    const customer = await tx.customer.findFirst({
      where: { id },
      include: { contacts: true },
    });
    if (!customer) throw httpApiError('NOT_FOUND', 'Cliente no encontrado.', 404);

    // Semántica — ADR 0009: facturado (services COMPLETED) contra cobrado (payments CONFIRMED).
    const [billed, paid, upcoming, lastService] = await Promise.all([
      tx.service.aggregate({
        where: { customerId: id, status: 'COMPLETED', isWarrantyVisit: false },
        _sum: { priceCents: true },
      }),
      tx.payment.aggregate({
        where: { customerId: id, status: 'CONFIRMED' },
        _sum: { amountCents: true },
      }),
      tx.service.count({
        where: {
          customerId: id,
          status: 'SCHEDULED',
          scheduledDate: { gte: startOfToday() },
        },
      }),
      tx.service.findFirst({
        where: { customerId: id, status: 'COMPLETED' },
        orderBy: { scheduledDate: 'desc' },
        select: { scheduledDate: true },
      }),
    ]);

    const billedCents = Number(billed._sum.priceCents ?? 0n);
    const paidCents = Number(paid._sum.amountCents ?? 0n);

    return {
      customer: toCustomerWithContacts(customer),
      accountBalanceCents: paidCents - billedCents,
      upcomingServicesCount: upcoming,
      lastServiceAt: lastService?.scheduledDate
        ? lastService.scheduledDate.toISOString()
        : null,
    };
  }

  private async replaceContacts(
    customerId: string,
    contacts: NonNullable<CreateCustomerRequest['contacts']>,
    actor: RequestUser,
  ): Promise<void> {
    const tx = this.db.current();
    await tx.customerContact.deleteMany({ where: { customerId } });
    for (const c of contacts) {
      await tx.customerContact.create({
        data: {
          id: c.id ?? randomUUID(),
          tenantId: actor.tenantId,
          customerId,
          name: c.name,
          role: c.role,
          phone: c.phone ?? null,
          email: c.email ?? null,
          isPrimary: c.isPrimary ?? false,
        },
      });
    }
  }

  private cursorWhere(cursor: string): Record<string, unknown> {
    const sep = cursor.lastIndexOf('__');
    if (sep <= 0) return {};
    const createdAt = cursor.slice(0, sep);
    const id = cursor.slice(sep + 2);
    const at = new Date(createdAt);
    if (Number.isNaN(at.getTime())) return {};
    return {
      OR: [
        { createdAt: { lt: at } },
        { AND: [{ createdAt: at }, { id: { lt: id } }] },
      ],
    };
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

interface CustomerRow {
  id: string;
  tenantId: string;
  type: string;
  legalName: string;
  tradeName: string | null;
  taxId: string | null;
  taxCondition: string | null;
  paymentTerms: string;
  creditLimitCents: bigint | null;
  notes: string | null;
  tags: string[];
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  contacts: Array<{
    id: string;
    name: string;
    role: string;
    phone: string | null;
    email: string | null;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

function toCustomerWithContacts(c: CustomerRow): CustomerWithContacts {
  const tenantId = c.tenantId;
  return {
    id: c.id,
    tenantId,
    type: c.type as CustomerWithContacts['type'],
    legalName: c.legalName,
    tradeName: c.tradeName,
    taxId: c.taxId,
    taxCondition: c.taxCondition as CustomerWithContacts['taxCondition'],
    paymentTerms: c.paymentTerms as CustomerWithContacts['paymentTerms'],
    creditLimitCents: c.creditLimitCents !== null ? Number(c.creditLimitCents) : null,
    notes: c.notes,
    tags: c.tags,
    archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    contacts: c.contacts.map((k) => ({
      id: k.id,
      tenantId,
      customerId: c.id,
      name: k.name,
      role: k.role as CustomerWithContacts['contacts'][number]['role'],
      phone: k.phone,
      email: k.email,
      isPrimary: k.isPrimary,
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
    })),
  };
}
