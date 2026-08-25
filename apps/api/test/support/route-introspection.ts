import type { INestApplication } from '@nestjs/common';

/**
 * Introspección de las rutas REALES registradas en el adapter Express de Nest — no una
 * lista mantenida a mano que se desactualiza. Es lo que hace el chequeo de
 * tenant-isolation.e2e.ts estructural: si mañana alguien agrega `GET /v1/customers/:id`
 * y se olvida de sumarlo a CROSS_TENANT_ENDPOINTS, el test lo detecta solo.
 *
 * Tipos locales mínimos en vez de `any`: Express no exporta un tipo público para su
 * router interno, pero la forma de `_router.stack` es estable hace años.
 */

interface ExpressRoute {
  path: string;
  methods: Record<string, boolean>;
}

interface ExpressLayer {
  route?: ExpressRoute;
  name?: string;
  handle?: { stack?: ExpressLayer[] };
}

interface ExpressAppWithRouter {
  _router?: { stack: ExpressLayer[] };
}

export interface RegisteredRoute {
  method: string;
  path: string;
}

function collectFromStack(stack: ExpressLayer[], routes: RegisteredRoute[]): void {
  for (const layer of stack) {
    const route = layer.route;
    if (route) {
      const methods = Object.keys(route.methods).filter((m) => route.methods[m]);
      for (const method of methods) {
        routes.push({ method: method.toUpperCase(), path: route.path });
      }
    } else if (layer.handle?.stack) {
      collectFromStack(layer.handle.stack, routes);
    }
  }
}

/** Todas las rutas HTTP registradas, con su método y path (incluye el prefijo /v1). */
export function listRegisteredRoutes(app: INestApplication): RegisteredRoute[] {
  const instance = app.getHttpAdapter().getInstance() as ExpressAppWithRouter;
  const routes: RegisteredRoute[] = [];
  if (instance._router?.stack) {
    collectFromStack(instance._router.stack, routes);
  }
  return routes;
}

/** Rutas con parámetro de path (:id, :slug, etc.) — candidatas a fuga cross-tenant (§K.4 Capa 3). */
export function routesWithPathParams(routes: RegisteredRoute[]): RegisteredRoute[] {
  return routes.filter((r) => /:[a-zA-Z]/.test(r.path));
}
