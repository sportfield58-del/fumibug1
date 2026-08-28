import type { PermissionKey } from '@fumibug/contracts';
import { LocationsService } from './locations.service';
import type { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import type { AuditService } from '../../common/audit/audit.service';
import type { GeocodingProvider } from './geocoding.provider';
import type { RequestUser } from '../../common/tenant/request-context';

const TID = 'a0000000-0000-4000-8000-000000000001';
const CID = '55500000-0000-4000-8000-000000000001';
const LID = '88800000-0000-4000-8000-000000000001';

const LOCATION_ROW = {
  id: LID,
  tenantId: TID,
  customerId: CID,
  label: 'Sucursal Centro',
  addressLine: 'Av. Corrientes 1234',
  city: 'CABA',
  province: 'Buenos Aires',
  postalCode: 'C1043',
  lat: { toNumber: () => -34.6037 },
  lng: { toNumber: () => -58.3816 },
  geocodeStatus: 'OK',
  accessNotes: null,
  hazardNotes: null,
  establishmentType: 'GASTRO',
  areaSqm: { toNumber: () => 180 },
  serviceWindowStart: new Date('1970-01-01T08:00:00Z'),
  serviceWindowEnd: new Date('1970-01-01T18:00:00Z'),
  zoneId: null,
  archivedAt: null,
  createdAt: new Date('2026-08-20T12:00:00Z'),
  updatedAt: new Date('2026-08-20T12:00:00Z'),
};

const ACTOR: RequestUser = {
  userId: 'admin-u',
  email: 'admin@fumibug.dev',
  tenantId: TID,
  roleKey: 'owner',
  permissions: ['location.read', 'location.create', 'location.update'] as PermissionKey[],
};

function buildService(overrides: { geocoder?: Partial<GeocodingProvider> } = {}) {
  const locFindFirst = jest.fn();
  const locFindMany = jest.fn();
  const locCreate = jest.fn();
  const locUpdate = jest.fn();
  const customerFindFirst = jest.fn();
  const geocode = jest.fn().mockResolvedValue({ lat: null, lng: null, status: 'FAILED' });

  const tx = {
    serviceLocation: { findFirst: locFindFirst, findMany: locFindMany, create: locCreate, update: locUpdate },
    customer: { findFirst: customerFindFirst },
  };

  const db = { current: () => tx } as unknown as TenantPrismaService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const geocoder: GeocodingProvider = { geocode, ...overrides.geocoder };

  return {
    service: new LocationsService(db, audit, geocoder),
    locFindFirst,
    locFindMany,
    locCreate,
    locUpdate,
    customerFindFirst,
    geocode,
  };
}

function expectCode(promise: Promise<unknown>, code: string) {
  return expect(promise).rejects.toMatchObject({ response: { error: { code } } });
}

describe('LocationsService — tenant-scoped', () => {
  it('getById de un id no visible → 404 NOT_FOUND (R40)', async () => {
    const { service, locFindFirst } = buildService();
    locFindFirst.mockResolvedValue(null);
    await expectCode(service.getById('u-de-otro-tenant'), 'NOT_FOUND');
  });

  it('getById mapea lat/lng/areaSqm Decimal a number y el window a HH:MM:SS', async () => {
    const { service, locFindFirst } = buildService();
    locFindFirst.mockResolvedValue(LOCATION_ROW);
    const result = await service.getById(LID);
    expect(result.lat).toBeCloseTo(-34.6037, 4);
    expect(result.lng).toBeCloseTo(-58.3816, 4);
    expect(result.areaSqm).toBe(180);
    expect(result.serviceWindowStart).toBe('08:00:00');
    expect(result.serviceWindowEnd).toBe('18:00:00');
  });

  it('listByCustomer exige que el cliente exista en el tenant (404 si no)', async () => {
    const { service, customerFindFirst } = buildService();
    customerFindFirst.mockResolvedValue(null);
    await expectCode(service.listByCustomer('u-de-otro-tenant'), 'NOT_FOUND');
  });

  it('listByCustomer devuelve las ubicaciones activas del cliente', async () => {
    const { service, customerFindFirst, locFindMany } = buildService();
    let listWhere: { customerId: string; archivedAt: null } | undefined;
    customerFindFirst.mockResolvedValue({ id: CID });
    locFindMany.mockImplementation((args: { where: typeof listWhere }) => {
      listWhere = args.where;
      return Promise.resolve([LOCATION_ROW]);
    });
    const result = await service.listByCustomer(CID);
    expect(listWhere?.customerId).toBe(CID);
    expect(listWhere?.archivedAt).toBeNull();
    expect(result).toHaveLength(1);
  });
});

describe('LocationsService.create + geocoding (ADR 0009)', () => {
  it('create sin coordenadas llama al provider; FAILED si no hay credenciales', async () => {
    const { service, customerFindFirst, locCreate, geocode } = buildService();
    let createData: { tenantId: string; geocodeStatus: string } | undefined;
    customerFindFirst.mockResolvedValue({ id: CID });
    locCreate.mockImplementation((args: { data: typeof createData }) => {
      createData = args.data;
      return Promise.resolve(LOCATION_ROW);
    });
    await service.create(CID, { addressLine: 'Av. Rivadavia 5000', establishmentType: 'GASTRO' }, ACTOR);
    expect(geocode).toHaveBeenCalledWith('Av. Rivadavia 5000', null);
    expect(createData?.tenantId).toBe(TID);
    expect(createData?.geocodeStatus).toBe('FAILED');
  });

  it('create con lat/lng propios ⇒ MANUAL y no llama al provider', async () => {
    const { service, customerFindFirst, locCreate, geocode } = buildService();
    let createData: { lat: number; lng: number; geocodeStatus: string } | undefined;
    customerFindFirst.mockResolvedValue({ id: CID });
    locCreate.mockImplementation((args: { data: typeof createData }) => {
      createData = args.data;
      return Promise.resolve(LOCATION_ROW);
    });
    await service.create(CID, { addressLine: 'Av. Rivadavia', establishmentType: 'GASTRO', lat: -34.6, lng: -58.4 }, ACTOR);
    expect(geocode).not.toHaveBeenCalled();
    expect(createData?.lat).toBe(-34.6);
    expect(createData?.lng).toBe(-58.4);
    expect(createData?.geocodeStatus).toBe('MANUAL');
  });
});

describe('LocationsService.update — If-Match', () => {
  it('If-Match no coincide → VERSION_CONFLICT', async () => {
    const { service, locFindFirst } = buildService();
    locFindFirst.mockResolvedValue(LOCATION_ROW);
    await expectCode(service.update(LID, { label: 'X' }, '"etag-viejo"'), 'VERSION_CONFLICT');
  });

  it('If-Match correcto edita el label', async () => {
    const { service, locFindFirst, locUpdate } = buildService();
    let updateData: { label: string } | undefined;
    locFindFirst
      .mockResolvedValueOnce(LOCATION_ROW)
      .mockResolvedValueOnce({ ...LOCATION_ROW, label: 'Renovada' });
    locUpdate.mockImplementation((args: { data: typeof updateData }) => {
      updateData = args.data;
      return Promise.resolve(LOCATION_ROW);
    });
    const result = await service.update(LID, { label: 'Renovada' }, '"2026-08-20T12:00:00.000Z"');
    expect(updateData?.label).toBe('Renovada');
    expect(result.id).toBe(LID);
  });
});

describe('LocationsService.geocode (ADR 0009)', () => {
  it('corrección manual (manualLat/Lng) ⇒ MANUAL, sin consultar al provider', async () => {
    const { service, locFindFirst, locUpdate, geocode } = buildService();
    let updateData: { lat: number; lng: number; geocodeStatus: string } | undefined;
    locFindFirst
      .mockResolvedValueOnce(LOCATION_ROW)
      .mockResolvedValueOnce({ ...LOCATION_ROW, geocodeStatus: 'MANUAL' });
    locUpdate.mockImplementation((args: { data: typeof updateData }) => {
      updateData = args.data;
      return Promise.resolve(LOCATION_ROW);
    });
    const result = await service.geocode(LID, { manualLat: -34.6, manualLng: -58.4 });
    expect(geocode).not.toHaveBeenCalled();
    expect(updateData?.lat).toBe(-34.6);
    expect(updateData?.lng).toBe(-58.4);
    expect(updateData?.geocodeStatus).toBe('MANUAL');
    expect(result.id).toBe(LID);
  });

  it('sin manual consulta al provider y guarda OK con coordenadas', async () => {
    const { service, locFindFirst, locUpdate, geocode } = buildService();
    let updateData: { lat: number; lng: number; geocodeStatus: string } | undefined;
    geocode.mockResolvedValue({ lat: -34.6037, lng: -58.3816, status: 'OK' });
    locFindFirst
      .mockResolvedValueOnce(LOCATION_ROW)
      .mockResolvedValueOnce({ ...LOCATION_ROW, geocodeStatus: 'OK' });
    locUpdate.mockImplementation((args: { data: typeof updateData }) => {
      updateData = args.data;
      return Promise.resolve(LOCATION_ROW);
    });
    await service.geocode(LID, {});
    expect(geocode).toHaveBeenCalledWith('Av. Corrientes 1234', 'CABA');
    expect(updateData?.lat).toBeCloseTo(-34.6037, 4);
    expect(updateData?.lng).toBeCloseTo(-58.3816, 4);
    expect(updateData?.geocodeStatus).toBe('OK');
  });
});
