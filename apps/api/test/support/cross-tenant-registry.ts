import type TestAgent from 'supertest/lib/agent';

/**
 * Registro de casos de aislamiento cross-tenant — docs/spec/11-seguridad.md §K.4
 * Capa 3 / CLAUDE.md §8: "Todo endpoint nuevo se agrega al test de aislamiento
 * cross-tenant. Es bloqueante en CI."
 *
 * La lista se mantiene acá; `tenant-isolation.e2e.ts` introspecciona las rutas reales
 * de Nest (`route-introspection.ts`) y falla el build si encuentra una ruta con
 * parámetro que no está registrada — el checklist de PR queda mecánicamente forzado.
 */
export interface CrossTenantContext {
  request: TestAgent;
  /** Token del tenant A con los permisos del recurso bajo prueba (no `audit.read`). */
  tenantAToken: string;
  /** ID de un usuario REAL del tenant B, para verificar que A responde 404 (R40). */
  crossTenantUserId: string;
}

export interface CrossTenantCase {
  description: string;
  /** Debe matchear literalmente el `path` que Nest registra (con :param). */
  routePattern: string;
  run: (ctx: CrossTenantContext) => Promise<void>;
}

export const CROSS_TENANT_ENDPOINTS: CrossTenantCase[] = [
  {
    description: 'GET /v1/users/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/users/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .get(`/v1/users/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'PATCH /v1/users/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/users/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .patch(`/v1/users/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('If-Match', `"etag"`)
        .send({ fullName: 'Nuevo' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/users/:id/activate con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/users/:id/activate',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/users/${crossTenantUserId}/activate`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/users/:id/deactivate con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/users/:id/deactivate',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/users/${crossTenantUserId}/deactivate`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/users/:id/reset-pin con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/users/:id/reset-pin',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/users/${crossTenantUserId}/reset-pin`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/users/:id/force-logout con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/users/:id/force-logout',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/users/${crossTenantUserId}/force-logout`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'GET /v1/customers/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/customers/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .get(`/v1/customers/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'PATCH /v1/customers/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/customers/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .patch(`/v1/customers/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('If-Match', `"etag"`)
        .send({ legalName: 'Nuevo' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/customers/:id/archive con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/customers/:id/archive',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/customers/${crossTenantUserId}/archive`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'GET /v1/customers/:id/summary con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/customers/:id/summary',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .get(`/v1/customers/${crossTenantUserId}/summary`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'GET /v1/customers/:id/locations con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/customers/:id/locations',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .get(`/v1/customers/${crossTenantUserId}/locations`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/customers/:id/locations con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/customers/:id/locations',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/customers/${crossTenantUserId}/locations`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ addressLine: 'X', establishmentType: 'HOME' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'GET /v1/locations/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/locations/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .get(`/v1/locations/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'PATCH /v1/locations/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/locations/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .patch(`/v1/locations/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('If-Match', `"etag"`)
        .send({ label: 'Nuevo' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/locations/:id/geocode con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/locations/:id/geocode',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/locations/${crossTenantUserId}/geocode`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({})
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'PATCH /v1/service-types/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/service-types/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .patch(`/v1/service-types/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('If-Match', `"etag"`)
        .send({ name: 'Nuevo' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'PATCH /v1/zones/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/zones/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .patch(`/v1/zones/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('If-Match', `"etag"`)
        .send({ name: 'Nuevo' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'PATCH /v1/price-lists/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/price-lists/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .patch(`/v1/price-lists/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('If-Match', `"etag"`)
        .send({ name: 'Nuevo' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'GET /v1/services/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/services/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .get(`/v1/services/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'PATCH /v1/services/:id con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/services/:id',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .patch(`/v1/services/${crossTenantUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('If-Match', `"1"`)
        .send({ priority: 'HIGH' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/services/:id/cancel con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/services/:id/cancel',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/services/${crossTenantUserId}/cancel`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ reason: 'CUSTOMER_REQUESTED' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/services/:id/reschedule con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/services/:id/reschedule',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/services/${crossTenantUserId}/reschedule`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ newDate: '2026-09-10', reason: 'x' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/services/:id/validate con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/services/:id/validate',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/services/${crossTenantUserId}/validate`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/services/:id/reject con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/services/:id/reject',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/services/${crossTenantUserId}/reject`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ reason: 'x' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/services/:id/reopen con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/services/:id/reopen',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/services/${crossTenantUserId}/reopen`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ reason: 'x' })
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
  {
    description: 'POST /v1/services/:id/warranty-visit con id de OTRO tenant → 404 (R40)',
    routePattern: '/v1/services/:id/warranty-visit',
    run: async ({ request, tenantAToken, crossTenantUserId }) => {
      const res = await request
        .post(`/v1/services/${crossTenantUserId}/warranty-visit`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  },
];

