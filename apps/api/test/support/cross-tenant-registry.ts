import type TestAgent from 'supertest/lib/agent';

/**
 * Registro de casos de aislamiento cross-tenant — docs/spec/11-seguridad.md §K.4
 * Capa 3 / CLAUDE.md §8: "Todo endpoint nuevo se agrega al test de aislamiento
 * cross-tenant. Es bloqueante en CI."
 *
 * Vacío en Fase 0 a propósito: ningún endpoint actual (`GET /auth/me`, `GET /ping`)
 * recibe un `:id` de un recurso tenant-scoped — devuelven datos del propio usuario del
 * token, no de un recurso parametrizado. El primer caso real lo agrega el primer
 * módulo de Fase 1 que exponga `GET /v1/<recurso>/:id`.
 *
 * `tenant-isolation.e2e.ts` no confía en que alguien se acuerde de mantener esta
 * lista: introspecciona las rutas reales de Nest (`route-introspection.ts`) y falla el
 * build si encuentra una ruta con parámetro que no está acá — así el checklist de PR
 * ("si agregué endpoint, está en el test de aislamiento") queda mecánicamente forzado.
 */
export interface CrossTenantContext {
  request: TestAgent;
  tenantAToken: string;
}

export interface CrossTenantCase {
  description: string;
  /** Debe matchear literalmente el `path` que Nest registra (con :param), para que la
   * introspección de rutas pueda emparejar este caso con la ruta real. */
  routePattern: string;
  /** Corre la request con un id de OTRO tenant y hace sus propios expects — el
   * mínimo exigible es `expect(res.status).toBe(404)` (R40: nunca 403, para no
   * filtrar existencia). */
  run: (ctx: CrossTenantContext) => Promise<void>;
}

export const CROSS_TENANT_ENDPOINTS: CrossTenantCase[] = [];
