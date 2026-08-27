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
  http.get('/v1/customers', () =>
    HttpResponse.json({
    "success": true,
    "data": [
      {
        "id": "55555555-5555-5555-5555-555555555555",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "type": "COMPANY",
        "legalName": "Comidas del Sur S.A.",
        "tradeName": "Restó del Sur",
        "taxId": "30-71234567-8",
        "taxCondition": "RESPONSABLE_INSCRIPTO",
        "paymentTerms": "ACCOUNT",
        "creditLimitCents": 50000000,
        "notes": null,
        "tags": [
          "gastronomico"
        ],
        "archivedAt": null,
        "createdAt": "2026-08-20T12:00:00.000Z",
        "updatedAt": "2026-08-20T12:00:00.000Z",
        "contacts": [
          {
            "id": "66666666-6666-6666-6666-666666666666",
            "tenantId": "f0000000-0000-4000-8000-000100000000",
            "customerId": "55555555-5555-5555-5555-555555555555",
            "name": "María Gerente",
            "role": "OWNER",
            "phone": "+54 9 11 5555-1111",
            "email": "maria@restodelsur.com.ar",
            "isPrimary": true,
            "createdAt": "2026-08-20T12:00:00.000Z",
            "updatedAt": "2026-08-20T12:00:00.000Z"
          }
        ]
      }
    ]
  }),
  ),
  http.post('/v1/customers', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "77777777-7777-7777-7777-777777777777",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "type": "INDIVIDUAL",
      "legalName": "Juan Pérez",
      "tradeName": null,
      "taxId": null,
      "taxCondition": null,
      "paymentTerms": "CASH",
      "creditLimitCents": null,
      "notes": null,
      "tags": [],
      "archivedAt": null,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "contacts": []
    }
  }),
  ),
  http.get('/v1/customers/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "55555555-5555-5555-5555-555555555555",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "type": "COMPANY",
      "legalName": "Comidas del Sur S.A.",
      "tradeName": "Restó del Sur",
      "taxId": "30-71234567-8",
      "taxCondition": "RESPONSABLE_INSCRIPTO",
      "paymentTerms": "ACCOUNT",
      "creditLimitCents": 50000000,
      "notes": null,
      "tags": [
        "gastronomico"
      ],
      "archivedAt": null,
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-20T12:00:00.000Z",
      "contacts": []
    }
  }),
  ),
  http.patch('/v1/customers/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "55555555-5555-5555-5555-555555555555",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "type": "COMPANY",
      "legalName": "Comidas del Sur S.A.",
      "tradeName": "Restó del Sur",
      "taxId": "30-71234567-8",
      "taxCondition": "RESPONSABLE_INSCRIPTO",
      "paymentTerms": "ACCOUNT",
      "creditLimitCents": 50000000,
      "notes": "Cliente VIP",
      "tags": [
        "gastronomico"
      ],
      "archivedAt": null,
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:10:00.000Z",
      "contacts": []
    }
  }),
  ),
  http.post('/v1/customers/:id/archive', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "55555555-5555-5555-5555-555555555555",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "type": "COMPANY",
      "legalName": "Comidas del Sur S.A.",
      "tradeName": "Restó del Sur",
      "taxId": "30-71234567-8",
      "taxCondition": "RESPONSABLE_INSCRIPTO",
      "paymentTerms": "ACCOUNT",
      "creditLimitCents": 50000000,
      "notes": null,
      "tags": [
        "gastronomico"
      ],
      "archivedAt": "2026-08-27T12:15:00.000Z",
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:15:00.000Z",
      "contacts": []
    }
  }),
  ),
  http.get('/v1/customers/:id/summary', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "customer": {
        "id": "55555555-5555-5555-5555-555555555555",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "type": "COMPANY",
        "legalName": "Comidas del Sur S.A.",
        "tradeName": "Restó del Sur",
        "taxId": "30-71234567-8",
        "taxCondition": "RESPONSABLE_INSCRIPTO",
        "paymentTerms": "ACCOUNT",
        "creditLimitCents": 50000000,
        "notes": null,
        "tags": [
          "gastronomico"
        ],
        "archivedAt": null,
        "createdAt": "2026-08-20T12:00:00.000Z",
        "updatedAt": "2026-08-20T12:00:00.000Z",
        "contacts": []
      },
      "accountBalanceCents": -1500000,
      "upcomingServicesCount": 2,
      "lastServiceAt": "2026-08-15T14:00:00.000Z"
    }
  }),
  ),
  http.get('/v1/customers/:id/locations', () =>
    HttpResponse.json({
    "success": true,
    "data": [
      {
        "id": "88888888-8888-8888-8888-888888888888",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "customerId": "55555555-5555-5555-5555-555555555555",
        "label": "Sucursal Centro",
        "addressLine": "Av. Corrientes 1234",
        "city": "CABA",
        "province": "Buenos Aires",
        "postalCode": "C1043",
        "lat": -34.6037,
        "lng": -58.3816,
        "geocodeStatus": "OK",
        "accessNotes": "Portero 24hs, timbre 3B",
        "hazardNotes": null,
        "establishmentType": "GASTRO",
        "areaSqm": 180,
        "serviceWindowStart": "08:00:00",
        "serviceWindowEnd": "18:00:00",
        "zoneId": null,
        "archivedAt": null,
        "createdAt": "2026-08-20T12:00:00.000Z",
        "updatedAt": "2026-08-20T12:00:00.000Z"
      }
    ]
  }),
  ),
  http.post('/v1/customers/:id/locations', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "99999999-9999-9999-9999-999999999999",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "label": null,
      "addressLine": "Av. Rivadavia 5000",
      "city": "CABA",
      "province": "Buenos Aires",
      "postalCode": null,
      "lat": null,
      "lng": null,
      "geocodeStatus": "PENDING",
      "accessNotes": null,
      "hazardNotes": null,
      "establishmentType": "OTHER",
      "areaSqm": null,
      "serviceWindowStart": null,
      "serviceWindowEnd": null,
      "zoneId": null,
      "archivedAt": null,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.get('/v1/locations/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "88888888-8888-8888-8888-888888888888",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "label": "Sucursal Centro",
      "addressLine": "Av. Corrientes 1234",
      "city": "CABA",
      "province": "Buenos Aires",
      "postalCode": "C1043",
      "lat": -34.6037,
      "lng": -58.3816,
      "geocodeStatus": "OK",
      "accessNotes": "Portero 24hs, timbre 3B",
      "hazardNotes": null,
      "establishmentType": "GASTRO",
      "areaSqm": 180,
      "serviceWindowStart": "08:00:00",
      "serviceWindowEnd": "18:00:00",
      "zoneId": null,
      "archivedAt": null,
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-20T12:00:00.000Z"
    }
  }),
  ),
  http.patch('/v1/locations/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "88888888-8888-8888-8888-888888888888",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "label": "Sucursal Centro (renovada)",
      "addressLine": "Av. Corrientes 1234",
      "city": "CABA",
      "province": "Buenos Aires",
      "postalCode": "C1043",
      "lat": -34.6037,
      "lng": -58.3816,
      "geocodeStatus": "OK",
      "accessNotes": "Portero 24hs, timbre 3B",
      "hazardNotes": null,
      "establishmentType": "GASTRO",
      "areaSqm": 180,
      "serviceWindowStart": "08:00:00",
      "serviceWindowEnd": "18:00:00",
      "zoneId": null,
      "archivedAt": null,
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:20:00.000Z"
    }
  }),
  ),
  http.post('/v1/locations/:id/geocode', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "88888888-8888-8888-8888-888888888888",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "label": "Sucursal Centro",
      "addressLine": "Av. Corrientes 1234",
      "city": "CABA",
      "province": "Buenos Aires",
      "postalCode": "C1043",
      "lat": -34.6037,
      "lng": -58.3816,
      "geocodeStatus": "OK",
      "accessNotes": "Portero 24hs, timbre 3B",
      "hazardNotes": null,
      "establishmentType": "GASTRO",
      "areaSqm": 180,
      "serviceWindowStart": "08:00:00",
      "serviceWindowEnd": "18:00:00",
      "zoneId": null,
      "archivedAt": null,
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:25:00.000Z"
    }
  }),
  ),
];
