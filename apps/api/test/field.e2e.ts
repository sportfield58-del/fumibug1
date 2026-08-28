import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@fumibug/db';
import { AppModule } from '../src/app.module';
import { JwtTestIssuer } from './support/jwt-test-issuer';

/**
 * docs/spec/03-modulos.md §C.10 "Ejecución de servicios", docs/spec/09-reglas.md
 * R2-R10/R16-R19/R24. Setup de datos vía Prisma admin (mismo criterio que
 * inventory-cash.e2e.ts) — lo que se prueba de punta a punta por HTTP es el flujo de
 * campo en sí, no la creación de clientes/rutas (ya cubierto en otros e2e).
 */
const CI_TEST_PASSWORD = 'ci_ephemeral_only_not_a_real_secret_3';

let admin: PrismaClient;
let app: INestApplication;
let jwks: JwtTestIssuer;
let tenant: { id: string };
let technicianId: string;
let techToken: string;

async function seed(): Promise<{
  customerId: string;
  locationId: string;
  serviceTypeId: string;
  service1Id: string;
  service2Id: string;
  routeId: string;
  stop1Id: string;
  stop2Id: string;
}> {
  const customer = await admin.customer.create({
    data: { id: randomUUID(), tenantId: tenant.id, type: 'INDIVIDUAL', legalName: 'Cliente Campo E2E' },
  });
  const location = await admin.serviceLocation.create({
    data: { id: randomUUID(), tenantId: tenant.id, customerId: customer.id, addressLine: 'Calle Falsa 123', lat: -34.6, lng: -58.4 },
  });
  const serviceType = await admin.serviceType.create({
    data: { id: randomUUID(), tenantId: tenant.id, key: `tipo-${randomUUID().slice(0, 8)}`, name: 'Desinsectación' },
  });
  const route = await admin.route.create({
    data: { id: randomUUID(), tenantId: tenant.id, code: `RT-${randomUUID().slice(0, 6)}`, technicianId, routeDate: new Date(), status: 'PUBLISHED' },
  });
  const service1 = await admin.service.create({
    data: {
      id: randomUUID(),
      tenantId: tenant.id,
      code: `SVC-${randomUUID().slice(0, 6)}`,
      customerId: customer.id,
      serviceLocationId: location.id,
      serviceTypeId: serviceType.id,
      status: 'DISPATCHED',
      priceCents: 4500000n,
    },
  });
  const service2 = await admin.service.create({
    data: {
      id: randomUUID(),
      tenantId: tenant.id,
      code: `SVC-${randomUUID().slice(0, 6)}`,
      customerId: customer.id,
      serviceLocationId: location.id,
      serviceTypeId: serviceType.id,
      status: 'DISPATCHED',
      priceCents: 1000000n,
    },
  });
  const stop1 = await admin.routeStop.create({
    data: { id: randomUUID(), tenantId: tenant.id, routeId: route.id, serviceId: service1.id, sequence: 1, status: 'PENDING' },
  });
  const stop2 = await admin.routeStop.create({
    data: { id: randomUUID(), tenantId: tenant.id, routeId: route.id, serviceId: service2.id, sequence: 2, status: 'ARRIVED', arrivedAt: new Date() },
  });
  return {
    customerId: customer.id,
    locationId: location.id,
    serviceTypeId: serviceType.id,
    service1Id: service1.id,
    service2Id: service2.id,
    routeId: route.id,
    stop1Id: stop1.id,
    stop2Id: stop2.id,
  };
}

beforeAll(async () => {
  admin = new PrismaClient();
  await admin.$executeRawUnsafe(`ALTER ROLE fumibug_app WITH PASSWORD '${CI_TEST_PASSWORD}'`);
  const appDbUrl = new URL(process.env.DATABASE_URL ?? '');
  appDbUrl.username = 'fumibug_app';
  appDbUrl.password = CI_TEST_PASSWORD;
  process.env.APP_DATABASE_URL = appDbUrl.toString();

  jwks = await JwtTestIssuer.start();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  process.env.SUPABASE_ISSUER = jwks.issuer;

  const t = await admin.tenant.create({ data: { name: 'Campo E2E', slug: `e2e-${randomUUID()}` } });
  tenant = { id: t.id };
  const tech = await admin.user.create({ data: { id: randomUUID(), email: `${randomUUID()}@e2e.fumibug.test`, isActive: true } });
  technicianId = tech.id;

  const PERMS = [
    'session.start',
    'session.finish',
    'stop.mark_no_show',
    'stop.skip',
    'payment.create',
    'inventory.read.own',
    'cash.read.own',
    'cash.close.own',
  ] as const;
  techToken = await jwks.issue({ sub: technicianId, tenantId: tenant.id, roleKey: 'technician', permissions: [...PERMS] });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await jwks?.stop();
  await admin.$disconnect();
});

function auth(req: request.Test): request.Test {
  return req.set('Authorization', `Bearer ${techToken}`);
}

describe('App de campo (§J.2, R2-R10/R16-R19/R24)', () => {
  let fixture: Awaited<ReturnType<typeof seed>>;
  let sessionId: string;
  const startEventId = randomUUID();

  beforeAll(async () => {
    fixture = await seed();
  });

  it('GET /v1/field/today devuelve la ruta publicada con los stops enriquecidos', async () => {
    const res = await auth(request(app.getHttpServer()).get('/v1/field/today')).expect(200);
    expect(res.body.data.route.id).toBe(fixture.routeId);
    expect(res.body.data.stops).toHaveLength(2);
    const stop1 = res.body.data.stops.find((s: { id: string }) => s.id === fixture.stop1Id);
    expect(stop1.location.addressLine).toBe('Calle Falsa 123');
    expect(stop1.serviceCode).toMatch(/^SVC-/);
  });

  it('POST /v1/field/stops/:id/arrive marca la llegada (R47: sin lat/lng igual funciona)', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post(`/v1/field/stops/${fixture.stop1Id}/arrive`)
        .send({ occurredAt: new Date().toISOString(), gpsStatus: 'DENIED', clientEventId: randomUUID() }),
    ).expect(201);
    expect(res.body.data.status).toBe('ARRIVED');
  });

  it('R2: POST /v1/field/services/:id/start abre la sesión y encadena las transiciones (service→IN_EXECUTION, stop→IN_PROGRESS, route→IN_PROGRESS)', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post(`/v1/field/services/${fixture.service1Id}/start`)
        .send({ occurredAt: new Date().toISOString(), gpsStatus: 'OK', lat: -34.6, lng: -58.4, accuracy: 5, clientEventId: startEventId }),
    ).expect(201);
    sessionId = res.body.data.id;
    expect(res.body.data.status).toBe('OPEN');

    const service = await admin.service.findUniqueOrThrow({ where: { id: fixture.service1Id } });
    expect(service.status).toBe('IN_EXECUTION');
    const stop = await admin.routeStop.findUniqueOrThrow({ where: { id: fixture.stop1Id } });
    expect(stop.status).toBe('IN_PROGRESS');
    const route = await admin.route.findUniqueOrThrow({ where: { id: fixture.routeId } });
    expect(route.status).toBe('IN_PROGRESS');
  });

  it('R43: repetir start con el mismo clientEventId devuelve la MISMA sesión (replay idempotente), no crea otra', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post(`/v1/field/services/${fixture.service1Id}/start`)
        .send({ occurredAt: new Date().toISOString(), gpsStatus: 'OK', clientEventId: startEventId }),
    ).expect(201);
    expect(res.body.data.id).toBe(sessionId);
    const count = await admin.serviceSession.count({ where: { clientEventId: startEventId } });
    expect(count).toBe(1);
  });

  it('R3: un operario no puede tener dos sesiones abiertas a la vez', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post(`/v1/field/services/${fixture.service2Id}/start`)
        .send({ occurredAt: new Date().toISOString(), gpsStatus: 'OK', clientEventId: randomUUID() }),
    ).expect(409);
    expect(res.body.error.code).toBe('TECHNICIAN_ALREADY_HAS_OPEN_SESSION');
  });

  it('R4: finish sin checklist completo → 422 SERVICE_CLOSURE_CHECKLIST_INCOMPLETE listando lo que falta', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post(`/v1/field/sessions/${sessionId}/finish`)
        .send({ paymentDecision: 'COLLECTED', occurredAt: new Date().toISOString(), clientEventId: randomUUID() }),
    ).expect(422);
    expect(res.body.error.code).toBe('SERVICE_CLOSURE_CHECKLIST_INCOMPLETE');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3); // fotos antes+después, insumos, pago (no hay Payment todavía), firma
  });

  it('R16/R18: registra consumo con dilución — calcula concentrate_equivalent y genera el movimiento CONSUMPTION', async () => {
    const supply = await admin.supply.create({
      data: {
        id: randomUUID(),
        tenantId: tenant.id,
        sku: `CIP-${randomUUID().slice(0, 6)}`,
        name: 'Cipermetrina',
        category: 'INSECTICIDE',
        registryAuthority: 'SENASA',
        registryNumber: 'SENASA-1',
        purchaseUnit: 'L',
        applicationUnit: 'ML',
        dilutionRateMlPerL: 20,
      },
    });
    const res = await auth(
      request(app.getHttpServer())
        .post(`/v1/field/sessions/${sessionId}/supplies`)
        .send({
          supplyId: supply.id,
          lotCode: 'L-CAMPO-1',
          quantityApplied: 8,
          unit: 'L',
          isDilutedMix: true,
          applicationMethod: 'SPRAY',
          treatedAreaSqm: 100,
          clientEventId: randomUUID(),
        }),
    ).expect(201);
    // 8 L de mezcla × 20 ml/L / 1000 = 0.16 L de concentrado (R18).
    expect(res.body.data.concentrateEquivalent).toBeCloseTo(0.16);

    // R19: el vehículo arrancaba en 0 — el consumo de campo SIEMPRE se acepta, y queda con saldo negativo marcado.
    const movement = await admin.inventoryMovement.findFirst({ where: { supplyId: supply.id, type: 'CONSUMPTION' } });
    expect(movement?.requiresAdjustment).toBe(true);
  });

  it('R24: cobra el servicio desde la sesión — genera Payment + cash_movement en la misma transacción', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post(`/v1/field/sessions/${sessionId}/payment`)
        .send({ amountCents: 4500000, method: 'CASH', clientEventId: randomUUID() }),
    ).expect(201);
    expect(res.body.data.status).toBe('CONFIRMED');
    expect(res.body.data.serviceId).toBe(fixture.service1Id);

    const stock = await auth(request(app.getHttpServer()).get('/v1/cash/accounts')).expect(200);
    const mine = stock.body.data.find((a: { ownerUserId: string }) => a.ownerUserId === technicianId);
    expect(mine.balanceCents).toBe(4500000);
  });

  it('registra la firma (o motivo de ausencia)', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post(`/v1/field/sessions/${sessionId}/signature`)
        .send({ noSignatureReason: 'CUSTOMER_UNAVAILABLE', clientEventId: randomUUID() }),
    ).expect(201);
    expect(res.body.data.noSignatureReason).toBe('CUSTOMER_UNAVAILABLE');
  });

  it('R4: sigue faltando evidencia — finish todavía bloquea', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post(`/v1/field/sessions/${sessionId}/finish`)
        .send({ paymentDecision: 'COLLECTED', occurredAt: new Date().toISOString(), clientEventId: randomUUID() }),
    ).expect(422);
    expect(res.body.error.details.some((d: { field: string }) => d.field === 'evidence')).toBe(true);
  });

  it('con evidencia BEFORE/AFTER cargada (simulando PR-207), finish cierra todo el árbol de estados', async () => {
    await admin.serviceEvidence.createMany({
      data: [
        { id: randomUUID(), tenantId: tenant.id, serviceSessionId: sessionId, type: 'PHOTO', category: 'BEFORE', storagePath: 'x/before.jpg', clientEventId: randomUUID() },
        { id: randomUUID(), tenantId: tenant.id, serviceSessionId: sessionId, type: 'PHOTO', category: 'AFTER', storagePath: 'x/after.jpg', clientEventId: randomUUID() },
      ],
    });

    const res = await auth(
      request(app.getHttpServer())
        .post(`/v1/field/sessions/${sessionId}/finish`)
        .send({ paymentDecision: 'COLLECTED', occurredAt: new Date().toISOString(), clientEventId: randomUUID() }),
    ).expect(201);
    expect(res.body.data.session.status).toBe('CLOSED');
    expect(res.body.data.serviceStatus).toBe('PENDING_VALIDATION');

    const stop = await admin.routeStop.findUniqueOrThrow({ where: { id: fixture.stop1Id } });
    expect(stop.status).toBe('DONE');
    const service = await admin.service.findUniqueOrThrow({ where: { id: fixture.service1Id } });
    expect(service.status).toBe('PENDING_VALIDATION');
  });

  it('POST /v1/field/cash/close declara la rendición de la caja propia del operario', async () => {
    const res = await auth(request(app.getHttpServer()).post('/v1/field/cash/close').send({ declaredCents: 4500000 })).expect(201);
    expect(res.body.data.status).toBe('DECLARED');
    expect(res.body.data.expectedCents).toBe(4500000);
  });
});
