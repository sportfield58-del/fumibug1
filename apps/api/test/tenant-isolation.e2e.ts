import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@fumibug/db';
import { AppModule } from '../src/app.module';
import { JwtTestIssuer } from './support/jwt-test-issuer';
import { listRegisteredRoutes, routesWithPathParams } from './support/route-introspection';
import { CROSS_TENANT_ENDPOINTS } from './support/cross-tenant-registry';

/**
 * Test de arquitectura bloqueante — docs/spec/11-seguridad.md §K.4 Capa 3 / ADR 0004:
 * "crea dos tenants con datos, se autentica como usuario del tenant A, y recorre TODOS
 * los endpoints de lectura intentando acceder a IDs del tenant B. Debe devolver 404 en
 * todos." CLAUDE.md §8: corre en CI y es bloqueante, sin excepciones.
 *
 * Contra un Postgres efímero real (no mocks): migra desde cero (test:tenant-isolation
 * en package.json corre `prisma migrate deploy` antes de este archivo), setea la
 * password de `fumibug_app` solo para este Postgres descartable, y arranca la app de
 * Nest completa (AppModule) para probar el circuito HTTP real, no unidades aisladas.
 */

// Password efímera SOLO para el Postgres descartable de este job de CI — se tira con el
// contenedor al terminar. No es un secreto real (mismo criterio que
// packages/db/test/migration.integration.spec.ts).
const CI_TEST_PASSWORD = 'ci_ephemeral_only_not_a_real_secret';

let admin: PrismaClient;
let app: INestApplication;
let jwks: JwtTestIssuer;

let tenantA: { id: string; userId: string };
let tenantB: { id: string; userId: string };
let tokenAWithPermission: string;
let tokenAWithoutPermission: string;
let tokenAUserWrite: string;

beforeAll(async () => {
  admin = new PrismaClient(); // usa DATABASE_URL (rol migrador/superusuario del Postgres de CI)
  await admin.$executeRawUnsafe(`ALTER ROLE fumibug_app WITH PASSWORD '${CI_TEST_PASSWORD}'`);

  const appDbUrl = new URL(process.env.DATABASE_URL ?? '');
  appDbUrl.username = 'fumibug_app';
  appDbUrl.password = CI_TEST_PASSWORD;
  process.env.APP_DATABASE_URL = appDbUrl.toString();

  jwks = await JwtTestIssuer.start();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  process.env.SUPABASE_ISSUER = jwks.issuer;

  // Dos tenants con un usuario cada uno — como superusuario, sin pasar por RLS
  // (es el rol migrador de CI, exactamente igual que en packages/db/test/*).
  tenantA = await seedTenantWithUser('Tenant A');
  tenantB = await seedTenantWithUser('Tenant B');

  tokenAWithPermission = await jwks.issue({
    sub: tenantA.userId,
    tenantId: tenantA.id,
    roleKey: 'owner',
    permissions: ['audit.read'],
  });
  tokenAWithoutPermission = await jwks.issue({
    sub: tenantA.userId,
    tenantId: tenantA.id,
    roleKey: 'technician',
    permissions: [],
  });
  // Para los endpoints que exigen permisos de users/* el actor debe tenerlos — un
  // 403 de PermissionGuard no probaría aislamiento cross-tenant (R40: nunca 403).
  // Las rutas de lectura exigen `user.read`; las de escritura (PATCH / :id/*)
  // exigen `user.update`. Este token acumula TODOS los permisos de los módulos
  // registrados (users, customers, locations) para que el loop de aislamiento
  // siempre llegue hasta el 404 cross-tenant y nunca se corte en un 403.
  tokenAUserWrite = await jwks.issue({
    sub: tenantA.userId,
    tenantId: tenantA.id,
    roleKey: 'owner',
    permissions: [
      'user.read',
      'user.update',
      'customer.read',
      'customer.create',
      'customer.update',
      'customer.archive',
      'location.read',
      'location.create',
      'location.update',
    ],
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await jwks?.stop();
  // Sin cleanup de datos: el test de /v1/ping deja audit_logs para tenantA, y esa
  // tabla es append-only (R42) — el tenant no se puede borrar mientras existan. Esto
  // corre contra el Postgres efímero de CI, que se descarta con el contenedor al
  // terminar el job; no hace falta dejarlo limpio.
  await admin.$disconnect();
});

async function seedTenantWithUser(name: string): Promise<{ id: string; userId: string }> {
  const tenant = await admin.tenant.create({
    data: { name, slug: `e2e-${randomUUID()}` },
  });
  const user = await admin.user.create({
    data: { id: randomUUID(), email: `${randomUUID()}@e2e.fumibug.test`, isActive: true },
  });
  return { id: tenant.id, userId: user.id };
}

describe('Plataforma — health y auth (Fase 0)', () => {
  it('GET /health no requiere auth', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('GET /v1/auth/me sin token → 401 UNAUTHENTICATED', async () => {
    const res = await request(app.getHttpServer()).get('/v1/auth/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /v1/auth/me con token del tenant A devuelve SOLO datos del tenant A', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${tokenAWithPermission}`)
      .expect(200);
    expect(res.body.data.tenant.id).toBe(tenantA.id);
    expect(res.body.data.user.id).toBe(tenantA.userId);
  });
});

describe('PermissionGuard (Fase 0, criterio de salida — GET /v1/ping)', () => {
  it('sin el permiso audit.read → 403 FORBIDDEN', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/ping')
      .set('Authorization', `Bearer ${tokenAWithoutPermission}`)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('con audit.read → 200, y queda auditado (AuditService en la misma tx)', async () => {
    const before = await admin.auditLog.count({ where: { tenantId: tenantA.id, action: 'ping' } });
    const res = await request(app.getHttpServer())
      .get('/v1/ping')
      .set('Authorization', `Bearer ${tokenAWithPermission}`)
      .expect(200);
    expect(res.body.data.tenantId).toBe(tenantA.id);
    const after = await admin.auditLog.count({ where: { tenantId: tenantA.id, action: 'ping' } });
    expect(after).toBe(before + 1);
  });
});

describe('§K.4 Capa 3 — aislamiento cross-tenant', () => {
  it('setup: tenantA y tenantB son tenants distintos (fixture lista para Fase 1)', () => {
    expect(tenantA.id).not.toBe(tenantB.id);
  });

  it(
    'toda ruta HTTP con parámetro de path está registrada en CROSS_TENANT_ENDPOINTS ' +
      '(si este test falla, agregaste un endpoint con :id y te olvidaste de sumarlo)',
    () => {
      const paramRoutes = routesWithPathParams(listRegisteredRoutes(app));
      const registered = new Set(CROSS_TENANT_ENDPOINTS.map((c) => c.routePattern));
      const missing = paramRoutes.filter((r) => !registered.has(r.path));
      expect(missing).toEqual([]);
    },
  );

  if (CROSS_TENANT_ENDPOINTS.length === 0) {
    it.todo(
      'sin casos todavía — Fase 0 no tiene endpoints con :id de recurso tenant-scoped. ' +
        'El primer módulo de Fase 1 que exponga uno agrega su caso acá.',
    );
  }

    for (const testCase of CROSS_TENANT_ENDPOINTS) {
      it(`${testCase.description} (${testCase.routePattern})`, async () => {
        await testCase.run({
          request: request(app.getHttpServer()),
          tenantAToken: tokenAUserWrite,
          crossTenantUserId: tenantB.userId,
        });
      });
    }
});
