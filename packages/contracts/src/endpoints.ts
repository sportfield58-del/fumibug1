import { z, type ZodTypeAny } from 'zod';
import { MeResponseSchema } from './schemas/auth';
import { RoleWithPermissionsSchema } from './schemas/role';
import {
  CreateUserRequestSchema,
  CreateUserResponseSchema,
  ForceLogoutResponseSchema,
  ResetPinResponseSchema,
  UpdateUserRequestSchema,
  UserListQuerySchema,
  UserWithMembershipSchema,
} from './schemas/user';

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

export interface EndpointDef<
  Req extends ZodTypeAny | undefined,
  Res extends ZodTypeAny,
  Qry extends ZodTypeAny | undefined = undefined,
> {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Relativo a /v1, sin barra inicial. Puede llevar `:param` (ej. 'users/:id'). */
  path: string;
  summary: string;
  requiresAuth: boolean;
  /** Body de POST/PATCH/PUT. */
  request?: Req;
  /** Query string de GET (ej. paginación, filtros). */
  query?: Qry;
  response: Res;
  example: z.infer<Res>;
}

function endpoint<
  Req extends ZodTypeAny | undefined,
  Res extends ZodTypeAny,
  Qry extends ZodTypeAny | undefined = undefined,
>(def: EndpointDef<Req, Res, Qry>): EndpointDef<Req, Res, Qry> {
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

  // ==========================================================================
  // Fase 1 — Usuarios y roles (docs/spec/03-modulos.md §C.2, prompts/TASK_BOARD.md PR-101)
  // ==========================================================================

  listUsers: endpoint({
    id: 'listUsers',
    method: 'GET',
    path: 'users',
    summary: 'Lista de usuarios del tenant, con su membership y ficha técnica si aplica.',
    requiresAuth: true,
    query: UserListQuerySchema,
    response: z.array(UserWithMembershipSchema),
    example: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'diego@fumibug.dev',
        username: 'diego',
        fullName: 'Diego Operario',
        phone: null,
        avatarUrl: null,
        color: '#16A34A',
        isActive: true,
        lastLoginAt: '2026-08-25T13:00:00.000Z',
        createdAt: '2026-08-20T12:00:00.000Z',
        updatedAt: '2026-08-20T12:00:00.000Z',
        membershipStatus: 'ACTIVE',
        roleId: '33333333-3333-3333-3333-333333333333',
        roleKey: 'operator',
        roleName: 'Operario',
        technicianProfile: {
          userId: '22222222-2222-2222-2222-222222222222',
          tenantId: 'f0000000-0000-4000-8000-000100000000',
          licenseNumber: 'LS-4821',
          licenseType: 'SANITARY_BOOK',
          licenseExpiresAt: '2026-09-20',
          signatureUrl: null,
          vehicleId: null,
          stockLocationId: null,
          createdAt: '2026-08-20T12:00:00.000Z',
          updatedAt: '2026-08-20T12:00:00.000Z',
        },
      },
    ],
  }),

  createUser: endpoint({
    id: 'createUser',
    method: 'POST',
    path: 'users',
    summary: 'Alta de usuario (admin/operario/DT), con generación de PIN temporal si es operario.',
    requiresAuth: true,
    request: CreateUserRequestSchema,
    response: CreateUserResponseSchema,
    example: {
      user: {
        id: '44444444-4444-4444-4444-444444444444',
        email: 'nuevo.operario@fumibug.internal',
        username: 'nuevo.operario',
        fullName: 'Nuevo Operario',
        phone: null,
        avatarUrl: null,
        color: '#F59E0B',
        isActive: true,
        lastLoginAt: null,
        createdAt: '2026-08-27T12:00:00.000Z',
        updatedAt: '2026-08-27T12:00:00.000Z',
        membershipStatus: 'ACTIVE',
        roleId: '33333333-3333-3333-3333-333333333333',
        roleKey: 'operator',
        roleName: 'Operario',
        technicianProfile: {
          userId: '44444444-4444-4444-4444-444444444444',
          tenantId: 'f0000000-0000-4000-8000-000100000000',
          licenseNumber: null,
          licenseType: 'SANITARY_BOOK',
          licenseExpiresAt: null,
          signatureUrl: null,
          vehicleId: null,
          stockLocationId: null,
          createdAt: '2026-08-27T12:00:00.000Z',
          updatedAt: '2026-08-27T12:00:00.000Z',
        },
      },
      temporaryPin: '482910',
    },
  }),

  getUser: endpoint({
    id: 'getUser',
    method: 'GET',
    path: 'users/:id',
    summary: 'Detalle de un usuario, con membership y ficha técnica.',
    requiresAuth: true,
    response: UserWithMembershipSchema,
    example: {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'diego@fumibug.dev',
      username: 'diego',
      fullName: 'Diego Operario',
      phone: null,
      avatarUrl: null,
      color: '#16A34A',
      isActive: true,
      lastLoginAt: '2026-08-25T13:00:00.000Z',
      createdAt: '2026-08-20T12:00:00.000Z',
      updatedAt: '2026-08-20T12:00:00.000Z',
      membershipStatus: 'ACTIVE',
      roleId: '33333333-3333-3333-3333-333333333333',
      roleKey: 'operator',
      roleName: 'Operario',
      technicianProfile: {
        userId: '22222222-2222-2222-2222-222222222222',
        tenantId: 'f0000000-0000-4000-8000-000100000000',
        licenseNumber: 'LS-4821',
        licenseType: 'SANITARY_BOOK',
        licenseExpiresAt: '2026-09-20',
        signatureUrl: null,
        vehicleId: null,
        stockLocationId: null,
        createdAt: '2026-08-20T12:00:00.000Z',
        updatedAt: '2026-08-20T12:00:00.000Z',
      },
    },
  }),

  updateUser: endpoint({
    id: 'updateUser',
    method: 'PATCH',
    path: 'users/:id',
    summary: 'Edita datos de un usuario (requiere If-Match). No cambia email/username ni rol.',
    requiresAuth: true,
    request: UpdateUserRequestSchema,
    response: UserWithMembershipSchema,
    example: {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'diego@fumibug.dev',
      username: 'diego',
      fullName: 'Diego Operario',
      phone: '+54 9 11 5555-0000',
      avatarUrl: null,
      color: '#16A34A',
      isActive: true,
      lastLoginAt: '2026-08-25T13:00:00.000Z',
      createdAt: '2026-08-20T12:00:00.000Z',
      updatedAt: '2026-08-27T12:05:00.000Z',
      membershipStatus: 'ACTIVE',
      roleId: '33333333-3333-3333-3333-333333333333',
      roleKey: 'operator',
      roleName: 'Operario',
      technicianProfile: {
        userId: '22222222-2222-2222-2222-222222222222',
        tenantId: 'f0000000-0000-4000-8000-000100000000',
        licenseNumber: 'LS-4821',
        licenseType: 'SANITARY_BOOK',
        licenseExpiresAt: '2026-09-20',
        signatureUrl: null,
        vehicleId: null,
        stockLocationId: null,
        createdAt: '2026-08-20T12:00:00.000Z',
        updatedAt: '2026-08-27T12:05:00.000Z',
      },
    },
  }),

  resetUserPin: endpoint({
    id: 'resetUserPin',
    method: 'POST',
    path: 'users/:id/reset-pin',
    summary: 'Genera un PIN temporal para un operario y fuerza cambio en el próximo login.',
    requiresAuth: true,
    response: ResetPinResponseSchema,
    example: { temporaryPin: '731045' },
  }),

  forceLogoutUser: endpoint({
    id: 'forceLogoutUser',
    method: 'POST',
    path: 'users/:id/force-logout',
    summary: 'Revoca todas las sesiones activas de un usuario.',
    requiresAuth: true,
    response: ForceLogoutResponseSchema,
    example: { revokedSessions: 1 },
  }),

  listRoles: endpoint({
    id: 'listRoles',
    method: 'GET',
    path: 'roles',
    summary: 'Los roles del tenant con su matriz de permisos resuelta.',
    requiresAuth: true,
    response: z.array(RoleWithPermissionsSchema),
    example: [
      {
        id: '33333333-3333-3333-3333-333333333333',
        tenantId: 'f0000000-0000-4000-8000-000100000000',
        key: 'operator',
        name: 'Operario',
        isSystem: true,
        description: 'Ejecuta servicios en campo.',
        createdAt: '2026-08-20T12:00:00.000Z',
        updatedAt: '2026-08-20T12:00:00.000Z',
        permissions: [
          { roleId: '33333333-3333-3333-3333-333333333333', permissionKey: 'service.read.own', scope: 'own' },
        ],
      },
    ],
  }),
} as const;

export type EndpointId = keyof typeof ENDPOINTS;
