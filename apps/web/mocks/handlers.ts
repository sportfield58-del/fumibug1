// GENERADO por packages/contracts/scripts/generate.ts a partir de packages/contracts/src/endpoints.ts.
// No editar a mano — correr `pnpm generate` desde la raíz para regenerar.

import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/v1/auth/me', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "user": {
        "id": "11111111-1111-1111-1111-111111111111",
        "email": "owner@fumibug.dev",
        "username": null,
        "fullName": "Carlos Owner",
        "phone": null,
        "avatarUrl": null,
        "color": "#2563EB",
        "isActive": true,
        "lastLoginAt": "2026-08-21T12:00:00.000Z",
        "createdAt": "2026-08-21T12:00:00.000Z",
        "updatedAt": "2026-08-21T12:00:00.000Z"
      },
      "tenant": {
        "id": "f0000000-0000-4000-8000-000100000000",
        "name": "Fumibug",
        "slug": "fumibug",
        "legalName": "Fumibug S.R.L.",
        "taxId": "30-71234567-8",
        "healthAuthorizationNumber": null,
        "logoUrl": null,
        "address": null,
        "phone": null,
        "email": null,
        "timezone": "America/Argentina/Buenos_Aires",
        "plan": "CORE",
        "status": "ACTIVE",
        "settings": {},
        "createdAt": "2026-08-21T12:00:00.000Z",
        "updatedAt": "2026-08-21T12:00:00.000Z"
      },
      "roleKey": "owner",
      "permissions": [
        "audit.read",
        "user.read"
      ]
    }
  }),
  ),
  http.get('/v1/ping', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "userId": "11111111-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "roleKey": "owner",
      "permissions": [
        "audit.read"
      ]
    }
  }),
  ),
  http.get('/v1/users', () =>
    HttpResponse.json({
    "success": true,
    "data": [
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "email": "diego@fumibug.dev",
        "username": "diego",
        "fullName": "Diego Operario",
        "phone": null,
        "avatarUrl": null,
        "color": "#16A34A",
        "isActive": true,
        "lastLoginAt": "2026-08-25T13:00:00.000Z",
        "createdAt": "2026-08-20T12:00:00.000Z",
        "updatedAt": "2026-08-20T12:00:00.000Z",
        "membershipStatus": "ACTIVE",
        "roleId": "33333333-3333-3333-3333-333333333333",
        "roleKey": "operator",
        "roleName": "Operario",
        "technicianProfile": {
          "userId": "22222222-2222-2222-2222-222222222222",
          "tenantId": "f0000000-0000-4000-8000-000100000000",
          "licenseNumber": "LS-4821",
          "licenseType": "SANITARY_BOOK",
          "licenseExpiresAt": "2026-09-20",
          "signatureUrl": null,
          "vehicleId": null,
          "stockLocationId": null,
          "createdAt": "2026-08-20T12:00:00.000Z",
          "updatedAt": "2026-08-20T12:00:00.000Z"
        }
      }
    ]
  }),
  ),
  http.post('/v1/users', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "user": {
        "id": "44444444-4444-4444-4444-444444444444",
        "email": "nuevo.operario@fumibug.internal",
        "username": "nuevo.operario",
        "fullName": "Nuevo Operario",
        "phone": null,
        "avatarUrl": null,
        "color": "#F59E0B",
        "isActive": true,
        "lastLoginAt": null,
        "createdAt": "2026-08-27T12:00:00.000Z",
        "updatedAt": "2026-08-27T12:00:00.000Z",
        "membershipStatus": "ACTIVE",
        "roleId": "33333333-3333-3333-3333-333333333333",
        "roleKey": "operator",
        "roleName": "Operario",
        "technicianProfile": {
          "userId": "44444444-4444-4444-4444-444444444444",
          "tenantId": "f0000000-0000-4000-8000-000100000000",
          "licenseNumber": null,
          "licenseType": "SANITARY_BOOK",
          "licenseExpiresAt": null,
          "signatureUrl": null,
          "vehicleId": null,
          "stockLocationId": null,
          "createdAt": "2026-08-27T12:00:00.000Z",
          "updatedAt": "2026-08-27T12:00:00.000Z"
        }
      },
      "temporaryPin": "482910"
    }
  }),
  ),
  http.get('/v1/users/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "22222222-2222-2222-2222-222222222222",
      "email": "diego@fumibug.dev",
      "username": "diego",
      "fullName": "Diego Operario",
      "phone": null,
      "avatarUrl": null,
      "color": "#16A34A",
      "isActive": true,
      "lastLoginAt": "2026-08-25T13:00:00.000Z",
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-20T12:00:00.000Z",
      "membershipStatus": "ACTIVE",
      "roleId": "33333333-3333-3333-3333-333333333333",
      "roleKey": "operator",
      "roleName": "Operario",
      "technicianProfile": {
        "userId": "22222222-2222-2222-2222-222222222222",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "licenseNumber": "LS-4821",
        "licenseType": "SANITARY_BOOK",
        "licenseExpiresAt": "2026-09-20",
        "signatureUrl": null,
        "vehicleId": null,
        "stockLocationId": null,
        "createdAt": "2026-08-20T12:00:00.000Z",
        "updatedAt": "2026-08-20T12:00:00.000Z"
      }
    }
  }),
  ),
  http.patch('/v1/users/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "22222222-2222-2222-2222-222222222222",
      "email": "diego@fumibug.dev",
      "username": "diego",
      "fullName": "Diego Operario",
      "phone": "+54 9 11 5555-0000",
      "avatarUrl": null,
      "color": "#16A34A",
      "isActive": true,
      "lastLoginAt": "2026-08-25T13:00:00.000Z",
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:05:00.000Z",
      "membershipStatus": "ACTIVE",
      "roleId": "33333333-3333-3333-3333-333333333333",
      "roleKey": "operator",
      "roleName": "Operario",
      "technicianProfile": {
        "userId": "22222222-2222-2222-2222-222222222222",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "licenseNumber": "LS-4821",
        "licenseType": "SANITARY_BOOK",
        "licenseExpiresAt": "2026-09-20",
        "signatureUrl": null,
        "vehicleId": null,
        "stockLocationId": null,
        "createdAt": "2026-08-20T12:00:00.000Z",
        "updatedAt": "2026-08-27T12:05:00.000Z"
      }
    }
  }),
  ),
  http.post('/v1/users/:id/reset-pin', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "temporaryPin": "731045"
    }
  }),
  ),
  http.post('/v1/users/:id/force-logout', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "revokedSessions": 1
    }
  }),
  ),
  http.get('/v1/roles', () =>
    HttpResponse.json({
    "success": true,
    "data": [
      {
        "id": "33333333-3333-3333-3333-333333333333",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "key": "operator",
        "name": "Operario",
        "isSystem": true,
        "description": "Ejecuta servicios en campo.",
        "createdAt": "2026-08-20T12:00:00.000Z",
        "updatedAt": "2026-08-20T12:00:00.000Z",
        "permissions": [
          {
            "roleId": "33333333-3333-3333-3333-333333333333",
            "permissionKey": "service.read.own",
            "scope": "own"
          }
        ]
      }
    ]
  }),
  ),
];
