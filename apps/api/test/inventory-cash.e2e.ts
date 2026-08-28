import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@fumibug/db';
import { AppModule } from '../src/app.module';
import { JwtTestIssuer } from './support/jwt-test-issuer';

/**
 * docs/spec/13-inventario-caja.md §N/§O, docs/spec/09-reglas.md R16-R31. Contra un
 * Postgres real (mismo criterio que tenant-isolation.e2e.ts): valida las reglas de
 * negocio de inventario/caja de punta a punta vía HTTP, no solo el aislamiento de
 * tenant. Cada test nombra la regla que ejercita (CLAUDE.md §8).
 */
const CI_TEST_PASSWORD = 'ci_ephemeral_only_not_a_real_secret_2';

let admin: PrismaClient;
let app: INestApplication;
let jwks: JwtTestIssuer;
let tenant: { id: string; userId: string };
let ownerToken: string;

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

  const t = await admin.tenant.create({ data: { name: 'Inventario/Caja E2E', slug: `e2e-${randomUUID()}` } });
  const u = await admin.user.create({ data: { id: randomUUID(), email: `${randomUUID()}@e2e.fumibug.test`, isActive: true } });
  tenant = { id: t.id, userId: u.id };

  const PERMS = [
    'supply.create',
    'supply.update',
    'inventory.read.tenant',
    'inventory.transfer',
    'inventory.adjust',
    'payment.create',
    'payment.read.tenant',
    'payment.void',
    'cash.read.tenant',
    'cash.adjust',
    'cash.close.own',
    'cash.approve_closure',
  ] as const;
  ownerToken = await jwks.issue({ sub: tenant.userId, tenantId: tenant.id, roleKey: 'owner', permissions: [...PERMS] });
  // Nota: este token nunca tiene inventory.allow_negative — el test R19 depende de eso.

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
  return req.set('Authorization', `Bearer ${ownerToken}`);
}

describe('Inventario (§N, R16-R23)', () => {
  let supplyId: string;
  let warehouseId: string;
  let vehicleId: string;

  it('POST /v1/supplies da de alta un insumo', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/supplies')
        .send({
          sku: `CIP-${randomUUID().slice(0, 8)}`,
          name: 'Cipermetrina 25% EC',
          category: 'INSECTICIDE',
          registryAuthority: 'SENASA',
          registryNumber: 'SENASA-12345',
          purchaseUnit: 'L',
          applicationUnit: 'ML',
          requiresLotTracking: true,
        }),
    ).expect(201);
    supplyId = res.body.data.id;
    expect(res.body.data.name).toBe('Cipermetrina 25% EC');
  });

  it('GET /v1/stock-locations auto-provisiona el depósito central', async () => {
    const res = await auth(request(app.getHttpServer()).get('/v1/stock-locations')).expect(200);
    const warehouse = res.body.data.find((l: { type: string }) => l.type === 'WAREHOUSE');
    expect(warehouse).toBeDefined();
    warehouseId = warehouse.id;
  });

  it('crea una segunda ubicación (vehículo) directo en DB para probar TRANSFER', async () => {
    const row = await admin.stockLocation.create({
      data: { id: randomUUID(), tenantId: tenant.id, type: 'VEHICLE', name: 'Camioneta test' },
    });
    vehicleId = row.id;
  });

  it('R22: ADJUSTMENT sin motivo → 422 INVENTORY_ADJUST_REASON_REQUIRED', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/inventory/movements')
        .send({ type: 'ADJUSTMENT', supplyId, stockLocationId: warehouseId, quantity: 5 }),
    ).expect(422);
    expect(res.body.error.code).toBe('INVENTORY_ADJUST_REASON_REQUIRED');
  });

  it('POST /v1/inventory/movements PURCHASE suma stock al depósito', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/inventory/movements')
        .send({ type: 'PURCHASE', supplyId, stockLocationId: warehouseId, quantity: 10, lotCode: 'L-001' }),
    ).expect(201);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('PURCHASE');
    expect(res.body.data[0].quantityDelta).toBe(10);
  });

  it('GET /v1/inventory refleja el saldo comprado', async () => {
    const res = await auth(request(app.getHttpServer()).get('/v1/inventory').query({ supplyId })).expect(200);
    const row = res.body.data.find((r: { stockLocationId: string }) => r.stockLocationId === warehouseId);
    expect(row.quantity).toBe(10);
  });

  it('R21: TRANSFER genera el par TRANSFER_OUT/TRANSFER_IN espejo con el mismo referenceId', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/inventory/movements')
        .send({ type: 'TRANSFER', supplyId, fromStockLocationId: warehouseId, toStockLocationId: vehicleId, quantity: 4, lotCode: 'L-001' }),
    ).expect(201);
    expect(res.body.data).toHaveLength(2);
    const [out, into] = res.body.data;
    expect(out.type).toBe('TRANSFER_OUT');
    expect(out.quantityDelta).toBe(-4);
    expect(into.type).toBe('TRANSFER_IN');
    expect(into.quantityDelta).toBe(4);
    expect(out.referenceId).toBe(into.referenceId);
  });

  it('R19: un LOSS que dejaría el saldo negativo → 422 INVENTORY_WOULD_GO_NEGATIVE', async () => {
    const res = await auth(
      request(app.getHttpServer())
        .post('/v1/inventory/movements')
        .send({ type: 'LOSS', supplyId, stockLocationId: vehicleId, quantity: 999, reason: 'derrame' }),
    ).expect(422);
    expect(res.body.error.code).toBe('INVENTORY_WOULD_GO_NEGATIVE');
  });

  it('el saldo del depósito bajó 4 tras la transferencia (proyección R23)', async () => {
    const res = await auth(request(app.getHttpServer()).get('/v1/inventory').query({ supplyId })).expect(200);
    const warehouseRow = res.body.data.find((r: { stockLocationId: string }) => r.stockLocationId === warehouseId);
    const vehicleRow = res.body.data.find((r: { stockLocationId: string }) => r.stockLocationId === vehicleId);
    expect(warehouseRow.quantity).toBe(6);
    expect(vehicleRow.quantity).toBe(4);
  });
});

describe('Dinero (§O, R24-R29)', () => {
  let customerId: string;
  let paymentId: string;
  let cashAccountId: string;

  beforeAll(async () => {
    const customer = await admin.customer.create({
      data: { id: randomUUID(), tenantId: tenant.id, type: 'INDIVIDUAL', legalName: 'Cliente E2E' },
    });
    customerId = customer.id;
  });

  it('R24: un pago en efectivo genera cash_movement en la misma transacción', async () => {
    const res = await auth(
      request(app.getHttpServer()).post('/v1/payments').send({ customerId, amountCents: 450000, method: 'CASH' }),
    ).expect(201);
    paymentId = res.body.data.id;
    expect(res.body.data.status).toBe('CONFIRMED');

    const accounts = await auth(request(app.getHttpServer()).get('/v1/cash/accounts')).expect(200);
    const mine = accounts.body.data.find((a: { ownerUserId: string }) => a.ownerUserId === tenant.userId);
    expect(mine).toBeDefined();
    expect(mine.balanceCents).toBe(450000);
    cashAccountId = mine.id;
  });

  it('R25: un pago por transferencia NO toca la caja del operario', async () => {
    await auth(request(app.getHttpServer()).post('/v1/payments').send({ customerId, amountCents: 100000, method: 'TRANSFER' })).expect(
      201,
    );
    const accounts = await auth(request(app.getHttpServer()).get('/v1/cash/accounts')).expect(200);
    const mine = accounts.body.data.find((a: { id: string }) => a.id === cashAccountId);
    expect(mine.balanceCents).toBe(450000); // sin cambios
  });

  it('R28: conciliar con diferencia y sin motivo → 422 CASH_DIFFERENCE_REQUIRES_APPROVAL', async () => {
    const declare = await auth(
      request(app.getHttpServer()).post(`/v1/cash/accounts/${cashAccountId}/closures`).send({ declaredCents: 450000 }),
    ).expect(201);
    expect(declare.body.data.expectedCents).toBe(450000);
    const closureId = declare.body.data.id;

    const res = await auth(
      request(app.getHttpServer()).post(`/v1/cash/closures/${closureId}/reconcile`).send({ receivedCents: 445000 }),
    ).expect(422);
    expect(res.body.error.code).toBe('CASH_DIFFERENCE_REQUIRES_APPROVAL');

    const reconciled = await auth(
      request(app.getHttpServer())
        .post(`/v1/cash/closures/${closureId}/reconcile`)
        .send({ receivedCents: 445000, differenceReason: 'Faltó vuelto de un cliente.' }),
    ).expect(201);
    expect(reconciled.body.data.status).toBe('RECONCILED');
  });

  it('R29: la rendición conciliada deja el saldo de la caja en cero', async () => {
    const accounts = await auth(request(app.getHttpServer()).get('/v1/cash/accounts')).expect(200);
    const mine = accounts.body.data.find((a: { id: string }) => a.id === cashAccountId);
    expect(mine.balanceCents).toBe(0);
  });

  it('R26: anular un pago genera un asiento inverso, no edita el original', async () => {
    // El pago original ya fue rendido/conciliado — anularlo agrega un REVERSAL en el
    // período abierto nuevo, nunca toca el cash_movement original (append-only, R42).
    const res = await auth(request(app.getHttpServer()).post(`/v1/payments/${paymentId}/void`).send({ reason: 'Cobro duplicado.' })).expect(
      201,
    );
    expect(res.body.data.status).toBe('VOIDED');

    const again = await auth(request(app.getHttpServer()).post(`/v1/payments/${paymentId}/void`).send({ reason: 'de nuevo' })).expect(
      422,
    );
    expect(again.body.error.code).toBe('PAYMENT_ALREADY_VOIDED');

    const accounts = await auth(request(app.getHttpServer()).get('/v1/cash/accounts')).expect(200);
    const mine = accounts.body.data.find((a: { id: string }) => a.id === cashAccountId);
    expect(mine.balanceCents).toBe(-450000); // reversa del pago ya rendido
  });
});
