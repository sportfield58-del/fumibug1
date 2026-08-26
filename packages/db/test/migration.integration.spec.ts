import { PrismaClient } from '@prisma/client';

/**
 * Corre contra el Postgres efímero de CI (o cualquier Postgres vacío apuntado por
 * DATABASE_URL) DESPUÉS de `prisma migrate deploy` (ver el script test:integration de
 * package.json — las migraciones ya corrieron para cuando este archivo se ejecuta).
 *
 * No repite lo que ya prueba `prisma migrate deploy` (que el SQL sea válido). Prueba que
 * lo que ese SQL crea efectivamente hace lo que promete: RLS aísla por tenant, y los
 * triggers append-only bloquean UPDATE/DELETE. Esto es exactamente lo que docs/spec/
 * 11-seguridad.md §K.4 y docs/spec/09-reglas.md R42 exigen, y es fácil de romper en
 * silencio editando el SQL a mano — por eso el test, no solo la migración.
 */

const admin = new PrismaClient();

// Contraseña solo para este Postgres efímero de CI — se descarta con el contenedor al
// terminar el job. Nunca es un secreto real, así que no hace falta gestionarla como tal.
const CI_TEST_PASSWORD = 'ci_ephemeral_only_not_a_real_secret';

function appClient(): PrismaClient {
  const base = process.env.DATABASE_URL ?? '';
  const url = new URL(base);
  url.username = 'fumibug_app';
  url.password = CI_TEST_PASSWORD;
  return new PrismaClient({ datasources: { db: { url: url.toString() } } });
}

let app: PrismaClient;
let tenantAId: string;
let tenantBId: string;

beforeAll(async () => {
  await admin.$executeRawUnsafe(`ALTER ROLE fumibug_app WITH PASSWORD '${CI_TEST_PASSWORD}'`);
  app = appClient();

  const tenantA = await admin.tenant.create({ data: { name: 'CI Tenant A', slug: `ci-a-${Date.now()}` } });
  const tenantB = await admin.tenant.create({ data: { name: 'CI Tenant B', slug: `ci-b-${Date.now()}` } });
  tenantAId = tenantA.id;
  tenantBId = tenantB.id;
  await admin.customer.create({
    data: { tenantId: tenantAId, type: 'INDIVIDUAL', legalName: 'Cliente A' },
  });
  await admin.customer.create({
    data: { tenantId: tenantBId, type: 'INDIVIDUAL', legalName: 'Cliente B' },
  });
});

afterAll(async () => {
  await admin.$disconnect();
  await app.$disconnect();
});

describe('R39/§K.4: RLS aísla por tenant en la conexión de aplicación', () => {
  it('con SET LOCAL app.tenant_id, fumibug_app ve solo las filas de ese tenant', async () => {
    const rows = await app.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantAId}'`);
      return tx.customer.findMany({ where: { legalName: { startsWith: 'Cliente' } } });
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.legalName).toBe('Cliente A');
    expect(rows[0]?.tenantId).toBe(tenantAId);
  });

  it('sin SET LOCAL, fumibug_app no ve ninguna fila (fail-closed, no error)', async () => {
    // Regresión del bug de NULLIF: current_setting('app.tenant_id', true) puede devolver
    // '' en vez de NULL en una conexión reusada — sin el fix, esto tira una excepción de
    // cast a uuid en lugar de simplemente no devolver filas.
    await expect(
      app.customer.findMany({ where: { legalName: { startsWith: 'Cliente' } } }),
    ).resolves.toEqual([]);
  });

  it('con SET LOCAL al tenant equivocado, no ve las filas del otro tenant', async () => {
    const rows = await app.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
      return tx.customer.findMany({ where: { legalName: 'Cliente A' } });
    });
    expect(rows).toHaveLength(0);
  });
});

describe('R42: los triggers append-only bloquean UPDATE/DELETE', () => {
  it('audit_logs rechaza UPDATE incluso desde el rol admin/migrador', async () => {
    const log = await admin.auditLog.create({
      data: { tenantId: tenantAId, action: 'ci-test', entityType: 'test' },
    });
    await expect(admin.auditLog.update({ where: { id: log.id }, data: { action: 'x' } })).rejects.toThrow(
      /append-only/,
    );
  });

  it('fumibug_app además no tiene el privilegio de UPDATE sobre audit_logs', async () => {
    const log = await admin.auditLog.create({
      data: { tenantId: tenantAId, action: 'ci-test-2', entityType: 'test' },
    });
    await expect(
      app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantAId}'`);
        await tx.auditLog.update({ where: { id: log.id }, data: { action: 'x' } });
      }),
    ).rejects.toThrow();
  });
});

describe('Constraints estructurales que Prisma no puede expresar', () => {
  it('route_stops_route_sequence_unique es DEFERRABLE INITIALLY DEFERRED', async () => {
    const rows = await admin.$queryRawUnsafe<{ condeferrable: boolean; condeferred: boolean }[]>(`
      SELECT condeferrable, condeferred FROM pg_constraint
      WHERE conname = 'route_stops_route_sequence_unique';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ condeferrable: true, condeferred: true });
  });

  it('price_lists_no_overlapping_validity es un EXCLUDE constraint', async () => {
    const rows = await admin.$queryRawUnsafe<{ contype: string }[]>(`
      SELECT contype FROM pg_constraint WHERE conname = 'price_lists_no_overlapping_validity';
    `);
    expect(rows[0]?.contype).toBe('x');
  });

  it('fumibug_app existe, sin BYPASSRLS y sin ser superusuario', async () => {
    const rows = await admin.$queryRawUnsafe<{ rolsuper: boolean; rolbypassrls: boolean }[]>(`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'fumibug_app';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });
});
