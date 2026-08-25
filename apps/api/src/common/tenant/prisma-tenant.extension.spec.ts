import { applyTenantScope, TENANT_SCOPED_MODELS } from './prisma-tenant.extension';

/**
 * Tests de la Capa 1 (§K.4): la función es pura, así que se valida el contrato de
 * scoping sin levantar Prisma ni base. La validación contra DB real (RLS + GUC) es
 * el test de aislamiento cross-tenant del PR 9 (§K.4 Capa 3).
 */
describe('applyTenantScope (Capa 1)', () => {
  const TENANT = '0f7d2a58-6a55-4c11-b341-9f8c2b7e1001';

  it('modelos globales pasan intactos aunque no haya tenant', () => {
    const args = { where: { id: 'x' } };
    expect(applyTenantScope('User', 'findUnique', args, undefined)).toBe(args);
    expect(applyTenantScope('Permission', 'findMany', {}, undefined)).toEqual({});
    expect(applyTenantScope('Tenant', 'findUnique', { where: { id: 't' } }, TENANT)).toEqual({
      where: { id: 't' },
    });
  });

  it('operación tenant-scoped SIN contexto lanza (criterio §18)', () => {
    expect(() => applyTenantScope('Customer', 'findMany', {}, undefined)).toThrow(
      /Customer\.findMany sin tenant en contexto/,
    );
    expect(() => applyTenantScope('Service', 'create', { data: {} }, undefined)).toThrow(
      /Service\.create sin tenant en contexto/,
    );
  });

  describe('operaciones de filtro', () => {
    it('findMany sin where agrega el filtro', () => {
      const args = applyTenantScope('Customer', 'findMany', {}, TENANT);
      expect(args['where']).toEqual({ AND: [{}, { tenantId: TENANT }] });
    });

    it('findMany conserva las condiciones previas y las combina con AND', () => {
      const args = applyTenantScope(
        'Customer',
        'findMany',
        { where: { name: { contains: 'acme' } }, take: 10 },
        TENANT,
      );
      expect(args['where']).toEqual({
        AND: [{ name: { contains: 'acme' } }, { tenantId: TENANT }],
      });
      expect(args['take']).toBe(10);
    });

    it.each(['count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'] as const)(
      '%s también recibe el filtro',
      (op) => {
        const args = applyTenantScope('Payment', op, { where: { amount: 1 } }, TENANT);
        expect(args['where']).toEqual({
          AND: [{ amount: 1 }, { tenantId: TENANT }],
        });
      },
    );
  });

  describe('operaciones de creación', () => {
    it('create inyecta tenantId en data preservando el resto', () => {
      const args = applyTenantScope(
        'Customer',
        'create',
        { data: { name: 'Acme' } },
        TENANT,
      );
      expect(args['data']).toEqual({ name: 'Acme', tenantId: TENANT });
    });

    it('createMany inyecta tenantId en cada fila', () => {
      const args = applyTenantScope(
        'PriceListItem',
        'createMany',
        { data: [{ price: 1 }, { price: 2 }] },
        TENANT,
      );
      expect(args['data']).toEqual([
        { price: 1, tenantId: TENANT },
        { price: 2, tenantId: TENANT },
      ]);
    });
  });

  describe('operaciones por clave única', () => {
    it('exigen contexto pero no tocan el where (protección por RLS, Capa 2)', () => {
      const where = { id: 'abc' };
      const args = applyTenantScope('Certificate', 'findUniqueOrThrow', { where }, TENANT);
      expect(args['where']).toBe(where);

      expect(() =>
        applyTenantScope('Certificate', 'delete', { where }, undefined),
      ).toThrow(/sin tenant en contexto/);
    });

    it('upsert inyecta tenantId solo en la rama create', () => {
      const args = applyTenantScope(
        'Notification',
        'upsert',
        { where: { id: 'n1' }, create: { title: 'hola' }, update: { readAt: null } },
        TENANT,
      );
      expect(args['create']).toEqual({ title: 'hola', tenantId: TENANT });
      expect(args['update']).toEqual({ readAt: null });
    });
  });

  it('el catálogo cubre los 36 modelos tenant-scoped del schema', () => {
    expect(TENANT_SCOPED_MODELS.size).toBe(36);
    for (const globalModel of ['Tenant', 'User', 'Permission']) {
      expect(TENANT_SCOPED_MODELS.has(globalModel)).toBe(false);
    }
  });
});
