// GENERADO por packages/contracts/scripts/generate.ts a partir de packages/contracts/src/endpoints.ts.
// No editar a mano — correr `pnpm generate` desde la raíz para regenerar.

import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/v1/auth/me', () =>
    HttpResponse.json({
      success: true,
      data: {
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
  ),
  http.get('/v1/ping', () =>
    HttpResponse.json({
      success: true,
      data: {
        userId: '11111111-1111-1111-1111-111111111111',
        tenantId: 'f0000000-0000-4000-8000-000100000000',
        roleKey: 'owner',
        permissions: ['audit.read'],
      },
    }),
  ),
];
