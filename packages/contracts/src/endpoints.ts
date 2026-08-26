import { z, type ZodTypeAny } from 'zod';
import { MeResponseSchema } from './schemas/auth';

/**
 * Registro de endpoints — la fuente desde la que `scripts/generate.ts` produce
 * `docs/api/openapi.json`, el cliente tipado de `apps/web/lib/api` y los handlers de
 * MSW de `apps/web/mocks` (docs/spec/10-api.md §J.4, ADR 0005).
 *
 * Cada endpoint trae su propio `example`: dato válido según `response`, usado tal cual
 * en el OpenAPI y en el mock de MSW — así los mocks tienen "datos realistas" (CLAUDE.md,
 * PR 8) sin depender de una librería de mock-desde-schema genérica.
 *
 * Vacío de negocio a propósito: Fase 0 no tiene endpoints de negocio. Cada módulo de
 * Fase 1 agrega los suyos acá, en su PR de contrato (nunca mezclado con la
 * implementación — ADR 0005 regla dura #1).
 */

export interface EndpointDef<Req extends ZodTypeAny | undefined, Res extends ZodTypeAny> {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Relativo a /v1, sin barra inicial. */
  path: string;
  summary: string;
  requiresAuth: boolean;
  request?: Req;
  response: Res;
  example: z.infer<Res>;
}

function endpoint<Req extends ZodTypeAny | undefined, Res extends ZodTypeAny>(
  def: EndpointDef<Req, Res>,
): EndpointDef<Req, Res> {
  return def;
}

export const PingResponseSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  roleKey: z.string(),
  permissions: z.array(z.string()),
});
export type PingResponse = z.infer<typeof PingResponseSchema>;

export const ENDPOINTS = {
  authMe: endpoint({
    id: 'authMe',
    method: 'GET',
    path: 'auth/me',
    summary: 'Usuario, tenant, rol y permisos efectivos del token.',
    requiresAuth: true,
    response: MeResponseSchema,
    example: {
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'owner@fumibug.dev',
        username: null,
        fullName: 'Carlos Owner',
        phone: null,
        avatarUrl: null,
        color: '#2563EB',
        isActive: true,
        lastLoginAt: '2026-08-21T12:00:00.000Z',
        createdAt: '2026-08-21T12:00:00.000Z',
        updatedAt: '2026-08-21T12:00:00.000Z',
      },
      tenant: {
        id: 'f0000000-0000-4000-8000-000100000000',
        name: 'Fumibug',
        slug: 'fumibug',
        legalName: 'Fumibug S.R.L.',
        taxId: '30-71234567-8',
        healthAuthorizationNumber: null,
        logoUrl: null,
        address: null,
        phone: null,
        email: null,
        timezone: 'America/Argentina/Buenos_Aires',
        plan: 'CORE',
        status: 'ACTIVE',
        settings: {},
        createdAt: '2026-08-21T12:00:00.000Z',
        updatedAt: '2026-08-21T12:00:00.000Z',
      },
      roleKey: 'owner',
      permissions: ['audit.read', 'user.read'],
    },
  }),

  ping: endpoint({
    id: 'ping',
    method: 'GET',
    path: 'ping',
    summary:
      'Endpoint dummy de Fase 0 — prueba end-to-end de auth + tenant + permiso + auditoría (sin negocio).',
    requiresAuth: true,
    response: PingResponseSchema,
    example: {
      userId: '11111111-1111-1111-1111-111111111111',
      tenantId: 'f0000000-0000-4000-8000-000100000000',
      roleKey: 'owner',
      permissions: ['audit.read'],
    },
  }),
} as const;

export type EndpointId = keyof typeof ENDPOINTS;
