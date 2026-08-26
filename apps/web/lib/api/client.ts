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

async function request<T>(method: string, path: string): Promise<ApiResponse<T>> {
  const token = config.getAccessToken?.();
  const res = await fetch(`${config.baseUrl}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
