import { ApiErrorSchema, apiSuccessSchema } from './responses';
import { ErrorCodeSchema } from './errors';
import { ServiceStatusSchema } from './enums';
import { PermissionKeySchema } from './permissions';
import { TenantSchema } from './schemas/tenant';
import { z } from 'zod';

describe('responses', () => {
  it('ApiError: valida el ejemplo de docs/spec/10-api.md §J.1', () => {
    const payload = {
      success: false,
      error: {
        code: 'ROUTE_HAS_STARTED_STOPS',
        message: 'No se puede despublicar: 2 servicios ya comenzaron.',
        details: [{ field: 'stopIds', value: ['a', 'b'] }],
      },
      requestId: '01J000000000000000000000',
    };
    expect(ApiErrorSchema.parse(payload)).toEqual(payload);
  });

  it('apiSuccessSchema: envuelve cualquier schema de data', () => {
    const schema = apiSuccessSchema(z.object({ id: z.string() }));
    expect(schema.parse({ success: true, data: { id: '1' } })).toEqual({
      success: true,
      data: { id: '1' },
    });
  });

  it('ApiError: rechaza un error.code que no está en el catálogo', () => {
    expect(() =>
      ApiErrorSchema.parse({
        success: false,
        error: { code: 'NOT_A_REAL_CODE', message: 'x' },
        requestId: '1',
      }),
    ).toThrow();
  });
});

describe('enums', () => {
  it('ErrorCodeSchema: acepta los codes documentados en docs/spec/10-api.md §J.3', () => {
    for (const code of ['ROUTE_VALIDATION_FAILED', 'TECHNICIAN_LICENSE_EXPIRED', 'INSUFFICIENT_STOCK', 'VERSION_CONFLICT']) {
      expect(ErrorCodeSchema.parse(code)).toBe(code);
    }
  });

  it('ServiceStatusSchema: cubre las 10 transiciones de docs/spec/04-estados.md §D.3', () => {
    const statuses = ServiceStatusSchema.options;
    expect(statuses).toHaveLength(10);
    expect(statuses).toContain('DISPATCHED');
    expect(statuses).toContain('PENDING_VALIDATION');
  });
});

describe('permissions', () => {
  it('PermissionKeySchema: acepta un permiso con scope, ej. route.publish', () => {
    expect(PermissionKeySchema.parse('route.publish')).toBe('route.publish');
  });

  it('PermissionKeySchema: rechaza un permiso inventado', () => {
    expect(() => PermissionKeySchema.parse('route.teleport')).toThrow();
  });
});

describe('schemas/tenant', () => {
  it('TenantSchema: valida un tenant mínimo', () => {
    const tenant = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Fumibug',
      slug: 'fumibug',
      timezone: 'America/Argentina/Buenos_Aires',
      plan: 'CORE',
      status: 'ACTIVE',
      settings: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(TenantSchema.parse(tenant).slug).toBe('fumibug');
  });
});
