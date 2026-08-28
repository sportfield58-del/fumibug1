import { CustomerWithContactsSchema, type CreateCustomerRequest, type PermissionKey } from '@fumibug/contracts';
import { CustomersService } from './customers.service';
import type { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import type { AuditService } from '../../common/audit/audit.service';
import type { RequestUser } from '../../common/tenant/request-context';

const TID = 'a0000000-0000-4000-8000-000000000001';
const CID = '55500000-0000-4000-8000-000000000001';

const CUSTOMER_ROW = {
  id: CID,
  tenantId: TID,
  type: 'COMPANY',
  legalName: 'Comidas del Sur S.A.',
  tradeName: null,
  taxId: '30-71234567-8',
  taxCondition: 'RESPONSABLE_INSCRIPTO',
  paymentTerms: 'ACCOUNT',
  creditLimitCents: 50000000n,
  notes: null,
  tags: ['gastronomico'],
  archivedAt: null,
  createdAt: new Date('2026-08-20T12:00:00Z'),
  updatedAt: new Date('2026-08-20T12:00:00Z'),
  contacts: [],
};

const ACTOR: RequestUser = {
  userId: 'admin-u',
  email: 'admin@fumibug.dev',
  tenantId: TID,
  roleKey: 'owner',
  permissions: ['customer.read', 'customer.create', 'customer.update', 'customer.archive'] as PermissionKey[],
};

function buildService() {
  const customerFindFirst = jest.fn();
  const customerFindMany = jest.fn();
  const customerCreate = jest.fn();
  const customerUpdate = jest.fn();
  const contactCreate = jest.fn();
  const contactDeleteMany = jest.fn();
  const serviceAggregate = jest.fn();
  const paymentAggregate = jest.fn();
  const serviceCount = jest.fn();
  const serviceFindFirst = jest.fn();

  const tx = {
    customer: {
      findFirst: customerFindFirst,
      findMany: customerFindMany,
      create: customerCreate,
      update: customerUpdate,
    },
    customerContact: { create: contactCreate, deleteMany: contactDeleteMany },
    service: { aggregate: serviceAggregate, count: serviceCount, findFirst: serviceFindFirst },
    payment: { aggregate: paymentAggregate },
  };

  const db = { current: () => tx } as unknown as TenantPrismaService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;

  return {
    service: new CustomersService(db, audit),
    customerFindFirst,
    customerFindMany,
    customerCreate,
    customerUpdate,
    contactCreate,
    contactDeleteMany,
    serviceAggregate,
    paymentAggregate,
    serviceCount,
    serviceFindFirst,
  };
}

function expectCode(promise: Promise<unknown>, code: string) {
  return expect(promise).rejects.toMatchObject({ response: { error: { code } } });
}

describe('CustomersService — tenant-scoped (extensión de Prisma + RLS)', () => {
  it('getById de un id no visible en el tenant → 404 NOT_FOUND (R40)', async () => {
    const { service, customerFindFirst } = buildService();
    customerFindFirst.mockResolvedValue(null);
    await expectCode(service.getById('u-de-otro-tenant'), 'NOT_FOUND');
  });

  it('getById devuelve el cliente y CUMPLE CustomerWithContactsSchema', async () => {
    const { service, customerFindFirst } = buildService();
    customerFindFirst.mockResolvedValue(CUSTOMER_ROW);
    const result = await service.getById(CID);
    expect(result.legalName).toBe('Comidas del Sur S.A.');
    expect(() => CustomerWithContactsSchema.parse(result)).not.toThrow();
  });

  it('list usa findMany (tenant inyectado por la extensión) y devuelve array', async () => {
    const { service, customerFindMany } = buildService();
    customerFindMany.mockResolvedValue([CUSTOMER_ROW]);
    const data = await service.list({ limit: 20 });
    expect(customerFindMany).toHaveBeenCalled();
    expect(data).toHaveLength(1);
    expect(data[0]?.id).toBe(CID);
  });

  it('create crea el customer + contactos, audita y devuelve el cliente', async () => {
    const { service, customerCreate, contactCreate, customerFindFirst } = buildService();
    let createdData: { tenantId: string; legalName: string } | undefined;
    let createdContactData: { tenantId: string; role: string } | undefined;
    customerCreate.mockImplementation((args: { data: { tenantId: string; legalName: string } }) => {
      createdData = args.data;
      return Promise.resolve(CUSTOMER_ROW);
    });
    contactCreate.mockImplementation((args: { data: { tenantId: string; role: string } }) => {
      createdContactData = args.data;
      return Promise.resolve({});
    });
    customerFindFirst.mockResolvedValue(CUSTOMER_ROW);
    const input: CreateCustomerRequest = {
      type: 'COMPANY',
      legalName: 'Comidas del Sur S.A.',
      paymentTerms: 'ACCOUNT',
      tags: ['gastronomico'],
      contacts: [{ name: 'María', role: 'OWNER', isPrimary: true }],
    };
    const result = await service.create(input, ACTOR);
    expect(createdData?.tenantId).toBe(TID);
    expect(createdData?.legalName).toBe(input.legalName);
    expect(createdContactData?.tenantId).toBe(TID);
    expect(createdContactData?.role).toBe('OWNER');
    expect(result.id).toBe(CID);
  });
});

describe('CustomersService.update — If-Match', () => {
  it('If-Match no coincide → VERSION_CONFLICT', async () => {
    const { service, customerFindFirst } = buildService();
    customerFindFirst.mockResolvedValue(CUSTOMER_ROW);
    await expectCode(service.update(CID, { legalName: 'X' }, '"etag-viejo"', ACTOR), 'VERSION_CONFLICT');
  });

  it('If-Match correcto edita campos y reemplaza los contactos', async () => {
    const { service, customerUpdate, contactDeleteMany, contactCreate, customerFindFirst } = buildService();
    let updatedData: { legalName: string } | undefined;
    let createdContactData: { tenantId: string } | undefined;
    customerUpdate.mockImplementation((args: { data: { legalName: string } }) => {
      updatedData = args.data;
      return Promise.resolve(CUSTOMER_ROW);
    });
    contactCreate.mockImplementation((args: { data: { tenantId: string } }) => {
      createdContactData = args.data;
      return Promise.resolve({});
    });
    contactDeleteMany.mockResolvedValue({ count: 0 });
    customerFindFirst
      .mockResolvedValueOnce(CUSTOMER_ROW)
      .mockResolvedValueOnce({ ...CUSTOMER_ROW, updatedAt: new Date('2026-08-27T12:10:00Z') });
    const result = await service.update(
      CID,
      { legalName: 'Nuevo Nombre', contacts: [{ name: 'Nuevo C', role: 'ONSITE', isPrimary: true }] },
      '"2026-08-20T12:00:00.000Z"',
      ACTOR,
    );
    expect(updatedData?.legalName).toBe('Nuevo Nombre');
    expect(contactDeleteMany).toHaveBeenCalled();
    expect(createdContactData?.tenantId).toBe(TID);
    expect(result.id).toBe(CID);
  });
});

describe('CustomersService.archive', () => {
  it('archiva (soft delete) un cliente activo', async () => {
    const { service, customerFindFirst, customerUpdate } = buildService();
    let archiveData: { archivedAt: Date } | undefined;
    customerUpdate.mockImplementation((args: { data: { archivedAt: Date } }) => {
      archiveData = args.data;
      return Promise.resolve({ ...CUSTOMER_ROW, archivedAt: args.data.archivedAt });
    });
    customerFindFirst
      .mockResolvedValueOnce(CUSTOMER_ROW)
      .mockResolvedValueOnce({ ...CUSTOMER_ROW, archivedAt: new Date('2026-08-27T12:00:00Z') });
    const result = await service.archive(CID, ACTOR);
    expect(result.archivedAt).not.toBeNull();
    expect(archiveData?.archivedAt).toBeInstanceOf(Date);
  });

  it('cliente ya archivado → STATE_CONFLICT', async () => {
    const { service, customerFindFirst } = buildService();
    customerFindFirst.mockResolvedValue({ ...CUSTOMER_ROW, archivedAt: new Date('2026-08-27T12:00:00Z') });
    await expectCode(service.archive(CID, ACTOR), 'STATE_CONFLICT');
  });
});

describe('CustomersService.getSummary — ADR 0009', () => {
  it('balance = cobrado (CONFIRMED) − facturado (COMPLETED); negativo = debe', async () => {
    const { service, customerFindFirst, serviceAggregate, paymentAggregate, serviceCount, serviceFindFirst } =
      buildService();
    customerFindFirst.mockResolvedValue(CUSTOMER_ROW);
    serviceAggregate.mockResolvedValue({ _sum: { priceCents: 3000000n } });
    paymentAggregate.mockResolvedValue({ _sum: { amountCents: 1500000n } });
    serviceCount.mockResolvedValue(2);
    serviceFindFirst.mockResolvedValue({ scheduledDate: new Date('2026-08-15T00:00:00Z') });

    const summary = await service.getSummary(CID);
    expect(summary.accountBalanceCents).toBe(-1500000);
    expect(summary.upcomingServicesCount).toBe(2);
    expect(summary.lastServiceAt).toBe('2026-08-15T00:00:00.000Z');
  });
});
