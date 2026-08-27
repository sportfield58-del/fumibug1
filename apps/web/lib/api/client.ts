// GENERADO por packages/contracts/scripts/generate.ts a partir de packages/contracts/src/endpoints.ts.
// No editar a mano — correr `pnpm generate` desde la raíz para regenerar.

import type { ApiResponse } from '@fumibug/contracts';
import type { ENDPOINTS as endpoints } from '@fumibug/contracts';

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
}

let config: ApiClientConfig = { baseUrl: '/v1' };

/** OpenCode la llama una vez al iniciar la app con la baseUrl real y el getter del token. */
export function configureApiClient(next: Partial<ApiClientConfig>): void {
  config = { ...config, ...next };
}

function toQueryString(
  query: Record<string, string | number | boolean | null | undefined> | undefined,
): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const token = config.getAccessToken?.();
  const res = await fetch(`${config.baseUrl}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return (await res.json()) as ApiResponse<T>;
}

/** GET /v1/auth/me — Usuario, tenant, rol y permisos efectivos del token. */
export function getAuthMe(): Promise<ApiResponse<typeof endpoints.authMe.example>> {
  return request('GET', 'auth/me');
}

/** GET /v1/ping — Endpoint dummy de Fase 0 — prueba end-to-end de auth + tenant + permiso + auditoría (sin negocio). */
export function getPing(): Promise<ApiResponse<typeof endpoints.ping.example>> {
  return request('GET', 'ping');
}

/** GET /v1/users — Lista de usuarios del tenant, con su membership y ficha técnica si aplica. */
export function getListUsers(args?: { query?: ReturnType<NonNullable<typeof endpoints.listUsers.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listUsers.example>> {
  return request('GET', 'users' + toQueryString(args?.query));
}

/** POST /v1/users — Alta de usuario (admin/operario/DT), con generación de PIN temporal si es operario. */
export function postCreateUser(args: { body: ReturnType<NonNullable<typeof endpoints.createUser.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createUser.example>> {
  return request('POST', 'users', args.body);
}

/** GET /v1/users/:id — Detalle de un usuario, con membership y ficha técnica. */
export function getGetUser(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.getUser.example>> {
  return request('GET', `users/${args.params.id}`);
}

/** PATCH /v1/users/:id — Edita datos de un usuario (requiere If-Match). No cambia email/username ni rol. */
export function patchUpdateUser(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateUser.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateUser.example>> {
  return request('PATCH', `users/${args.params.id}`, args.body);
}

/** POST /v1/users/:id/reset-pin — Genera un PIN temporal para un operario y fuerza cambio en el próximo login. */
export function postResetUserPin(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.resetUserPin.example>> {
  return request('POST', `users/${args.params.id}/reset-pin`);
}

/** POST /v1/users/:id/force-logout — Revoca todas las sesiones activas de un usuario. */
export function postForceLogoutUser(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.forceLogoutUser.example>> {
  return request('POST', `users/${args.params.id}/force-logout`);
}

/** GET /v1/roles — Los roles del tenant con su matriz de permisos resuelta. */
export function getListRoles(): Promise<ApiResponse<typeof endpoints.listRoles.example>> {
  return request('GET', 'roles');
}

/** GET /v1/customers — Lista de clientes, con sus contactos. */
export function getListCustomers(args?: { query?: ReturnType<NonNullable<typeof endpoints.listCustomers.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listCustomers.example>> {
  return request('GET', 'customers' + toQueryString(args?.query));
}

/** POST /v1/customers — Alta de cliente, con contactos embebidos. */
export function postCreateCustomer(args: { body: ReturnType<NonNullable<typeof endpoints.createCustomer.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createCustomer.example>> {
  return request('POST', 'customers', args.body);
}

/** GET /v1/customers/:id — Detalle de un cliente con sus contactos. */
export function getGetCustomer(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.getCustomer.example>> {
  return request('GET', `customers/${args.params.id}`);
}

/** PATCH /v1/customers/:id — Edita un cliente (requiere If-Match). Reemplaza la lista de contactos si se envía. */
export function patchUpdateCustomer(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateCustomer.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateCustomer.example>> {
  return request('PATCH', `customers/${args.params.id}`, args.body);
}

/** POST /v1/customers/:id/archive — Archiva un cliente (soft delete — CLAUDE.md §5, sin DELETE de negocio). */
export function postArchiveCustomer(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.archiveCustomer.example>> {
  return request('POST', `customers/${args.params.id}/archive`);
}

/** GET /v1/customers/:id/summary — Cuenta corriente + resumen de actividad de un cliente. */
export function getGetCustomerSummary(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.getCustomerSummary.example>> {
  return request('GET', `customers/${args.params.id}/summary`);
}

/** GET /v1/customers/:id/locations — Ubicaciones de un cliente. */
export function getListCustomerLocations(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.listCustomerLocations.example>> {
  return request('GET', `customers/${args.params.id}/locations`);
}

/** POST /v1/customers/:id/locations — Alta de ubicación para un cliente. */
export function postCreateCustomerLocation(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.createCustomerLocation.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createCustomerLocation.example>> {
  return request('POST', `customers/${args.params.id}/locations`, args.body);
}

/** GET /v1/locations/:id — Detalle de una ubicación. */
export function getGetLocation(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.getLocation.example>> {
  return request('GET', `locations/${args.params.id}`);
}

/** PATCH /v1/locations/:id — Edita una ubicación (requiere If-Match). */
export function patchUpdateLocation(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateLocation.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateLocation.example>> {
  return request('PATCH', `locations/${args.params.id}`, args.body);
}

/** POST /v1/locations/:id/geocode — Geocodifica una ubicación (o aplica corrección manual de lat/lng). */
export function postGeocodeLocation(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.geocodeLocation.request>['parse']> }): Promise<ApiResponse<typeof endpoints.geocodeLocation.example>> {
  return request('POST', `locations/${args.params.id}/geocode`, args.body);
}
