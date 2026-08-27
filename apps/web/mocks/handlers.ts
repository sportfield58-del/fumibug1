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
  http.get('/v1/service-types', () =>
    HttpResponse.json({
    "success": true,
    "data": [
      {
        "id": "aaaaaaaa-1111-1111-1111-111111111111",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "key": "desinsectacion",
        "name": "Desinsectación",
        "defaultDurationMinutes": 45,
        "checklist": [],
        "requiredSupplyIds": [],
        "certificateTemplateKey": null,
        "createdAt": "2026-08-20T12:00:00.000Z",
        "updatedAt": "2026-08-20T12:00:00.000Z"
      }
    ]
  }),
  ),
  http.post('/v1/service-types', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "aaaaaaaa-2222-2222-2222-222222222222",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "key": "desratizacion",
      "name": "Desratización",
      "defaultDurationMinutes": 60,
      "checklist": [],
      "requiredSupplyIds": [],
      "certificateTemplateKey": null,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.patch('/v1/service-types/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "aaaaaaaa-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "key": "desinsectacion",
      "name": "Desinsectación",
      "defaultDurationMinutes": 50,
      "checklist": [],
      "requiredSupplyIds": [],
      "certificateTemplateKey": null,
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:30:00.000Z"
    }
  }),
  ),
  http.get('/v1/zones', () =>
    HttpResponse.json({
    "success": true,
    "data": [
      {
        "id": "bbbbbbbb-1111-1111-1111-111111111111",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "name": "Zona Norte",
        "color": "#2563EB",
        "createdAt": "2026-08-20T12:00:00.000Z",
        "updatedAt": "2026-08-20T12:00:00.000Z"
      }
    ]
  }),
  ),
  http.post('/v1/zones', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "bbbbbbbb-2222-2222-2222-222222222222",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "name": "Zona Sur",
      "color": "#16A34A",
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.patch('/v1/zones/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "bbbbbbbb-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "name": "Zona Norte (ampliada)",
      "color": "#2563EB",
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:35:00.000Z"
    }
  }),
  ),
  http.get('/v1/price-lists', () =>
    HttpResponse.json({
    "success": true,
    "data": [
      {
        "id": "cccccccc-1111-1111-1111-111111111111",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "name": "Lista general 2026 Q3",
        "validFrom": "2026-07-01",
        "validTo": null,
        "isDefault": true,
        "createdAt": "2026-08-20T12:00:00.000Z",
        "updatedAt": "2026-08-20T12:00:00.000Z",
        "items": [
          {
            "id": "dddddddd-1111-1111-1111-111111111111",
            "tenantId": "f0000000-0000-4000-8000-000100000000",
            "priceListId": "cccccccc-1111-1111-1111-111111111111",
            "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
            "establishmentType": null,
            "priceCents": 1500000,
            "pricePerSqmCents": null,
            "createdAt": "2026-08-20T12:00:00.000Z",
            "updatedAt": "2026-08-20T12:00:00.000Z"
          }
        ]
      }
    ]
  }),
  ),
  http.post('/v1/price-lists', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "cccccccc-2222-2222-2222-222222222222",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "name": "Lista clientes VIP",
      "validFrom": "2026-09-01",
      "validTo": null,
      "isDefault": false,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "items": []
    }
  }),
  ),
  http.patch('/v1/price-lists/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "cccccccc-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "name": "Lista general 2026 Q3 (ajustada)",
      "validFrom": "2026-07-01",
      "validTo": "2026-09-30",
      "isDefault": true,
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:40:00.000Z",
      "items": []
    }
  }),
  ),
  http.get('/v1/services', () =>
    HttpResponse.json({
    "success": true,
    "data": [
      {
        "id": "eeeeeeee-1111-1111-1111-111111111111",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "code": "SVC-000123",
        "customerId": "55555555-5555-5555-5555-555555555555",
        "serviceLocationId": "88888888-8888-8888-8888-888888888888",
        "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
        "contractId": null,
        "parentServiceId": null,
        "origin": "MANUAL",
        "status": "SCHEDULED",
        "targetPests": [
          "cucarachas"
        ],
        "scheduledDate": "2026-09-02",
        "windowStart": "09:00:00",
        "windowEnd": "12:00:00",
        "estimatedDurationMinutes": 45,
        "requiredTechnicians": 1,
        "priceCents": 1500000,
        "currency": "ARS",
        "priceListId": "cccccccc-1111-1111-1111-111111111111",
        "isWarrantyVisit": false,
        "warrantyUntil": null,
        "priority": "NORMAL",
        "notesInternal": null,
        "notesForTechnician": "Perro guardián — avisar en portería.",
        "cancellationReason": null,
        "cancelledBillable": null,
        "version": 1,
        "createdAt": "2026-08-27T12:00:00.000Z",
        "updatedAt": "2026-08-27T12:00:00.000Z"
      }
    ]
  }),
  ),
  http.post('/v1/services', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "eeeeeeee-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "SVC-000124",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "serviceLocationId": "88888888-8888-8888-8888-888888888888",
      "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
      "contractId": null,
      "parentServiceId": null,
      "origin": "MANUAL",
      "status": "DRAFT",
      "targetPests": [
        "cucarachas"
      ],
      "scheduledDate": "2026-09-02",
      "windowStart": "09:00:00",
      "windowEnd": "12:00:00",
      "estimatedDurationMinutes": 45,
      "requiredTechnicians": 1,
      "priceCents": 1500000,
      "currency": "ARS",
      "priceListId": "cccccccc-1111-1111-1111-111111111111",
      "isWarrantyVisit": false,
      "warrantyUntil": null,
      "priority": "NORMAL",
      "notesInternal": null,
      "notesForTechnician": "Perro guardián — avisar en portería.",
      "cancellationReason": null,
      "cancelledBillable": null,
      "version": 1,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.get('/v1/services/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "eeeeeeee-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "SVC-000123",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "serviceLocationId": "88888888-8888-8888-8888-888888888888",
      "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
      "contractId": null,
      "parentServiceId": null,
      "origin": "MANUAL",
      "status": "SCHEDULED",
      "targetPests": [
        "cucarachas"
      ],
      "scheduledDate": "2026-09-02",
      "windowStart": "09:00:00",
      "windowEnd": "12:00:00",
      "estimatedDurationMinutes": 45,
      "requiredTechnicians": 1,
      "priceCents": 1500000,
      "currency": "ARS",
      "priceListId": "cccccccc-1111-1111-1111-111111111111",
      "isWarrantyVisit": false,
      "warrantyUntil": null,
      "priority": "NORMAL",
      "notesInternal": null,
      "notesForTechnician": "Perro guardián — avisar en portería.",
      "cancellationReason": null,
      "cancelledBillable": null,
      "version": 1,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.patch('/v1/services/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "eeeeeeee-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "SVC-000123",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "serviceLocationId": "88888888-8888-8888-8888-888888888888",
      "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
      "contractId": null,
      "parentServiceId": null,
      "origin": "MANUAL",
      "status": "SCHEDULED",
      "targetPests": [
        "cucarachas"
      ],
      "scheduledDate": "2026-09-02",
      "windowStart": "09:00:00",
      "windowEnd": "12:00:00",
      "estimatedDurationMinutes": 45,
      "requiredTechnicians": 1,
      "priceCents": 1500000,
      "currency": "ARS",
      "priceListId": "cccccccc-1111-1111-1111-111111111111",
      "isWarrantyVisit": false,
      "warrantyUntil": null,
      "priority": "NORMAL",
      "notesInternal": null,
      "notesForTechnician": "Perro guardián — avisar en portería.",
      "cancellationReason": null,
      "cancelledBillable": null,
      "version": 2,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.post('/v1/services/:id/cancel', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "eeeeeeee-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "SVC-000123",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "serviceLocationId": "88888888-8888-8888-8888-888888888888",
      "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
      "contractId": null,
      "parentServiceId": null,
      "origin": "MANUAL",
      "status": "CANCELLED",
      "targetPests": [
        "cucarachas"
      ],
      "scheduledDate": "2026-09-02",
      "windowStart": "09:00:00",
      "windowEnd": "12:00:00",
      "estimatedDurationMinutes": 45,
      "requiredTechnicians": 1,
      "priceCents": 1500000,
      "currency": "ARS",
      "priceListId": "cccccccc-1111-1111-1111-111111111111",
      "isWarrantyVisit": false,
      "warrantyUntil": null,
      "priority": "NORMAL",
      "notesInternal": null,
      "notesForTechnician": "Perro guardián — avisar en portería.",
      "cancellationReason": "CUSTOMER_REQUESTED",
      "cancelledBillable": false,
      "version": 2,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.post('/v1/services/:id/reschedule', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "eeeeeeee-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "SVC-000123",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "serviceLocationId": "88888888-8888-8888-8888-888888888888",
      "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
      "contractId": null,
      "parentServiceId": null,
      "origin": "MANUAL",
      "status": "RESCHEDULED",
      "targetPests": [
        "cucarachas"
      ],
      "scheduledDate": "2026-09-10",
      "windowStart": "09:00:00",
      "windowEnd": "12:00:00",
      "estimatedDurationMinutes": 45,
      "requiredTechnicians": 1,
      "priceCents": 1500000,
      "currency": "ARS",
      "priceListId": "cccccccc-1111-1111-1111-111111111111",
      "isWarrantyVisit": false,
      "warrantyUntil": null,
      "priority": "NORMAL",
      "notesInternal": null,
      "notesForTechnician": "Perro guardián — avisar en portería.",
      "cancellationReason": null,
      "cancelledBillable": null,
      "version": 2,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.post('/v1/services/:id/validate', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "eeeeeeee-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "SVC-000123",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "serviceLocationId": "88888888-8888-8888-8888-888888888888",
      "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
      "contractId": null,
      "parentServiceId": null,
      "origin": "MANUAL",
      "status": "COMPLETED",
      "targetPests": [
        "cucarachas"
      ],
      "scheduledDate": "2026-09-02",
      "windowStart": "09:00:00",
      "windowEnd": "12:00:00",
      "estimatedDurationMinutes": 45,
      "requiredTechnicians": 1,
      "priceCents": 1500000,
      "currency": "ARS",
      "priceListId": "cccccccc-1111-1111-1111-111111111111",
      "isWarrantyVisit": false,
      "warrantyUntil": null,
      "priority": "NORMAL",
      "notesInternal": null,
      "notesForTechnician": "Perro guardián — avisar en portería.",
      "cancellationReason": null,
      "cancelledBillable": null,
      "version": 3,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.post('/v1/services/:id/reject', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "eeeeeeee-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "SVC-000123",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "serviceLocationId": "88888888-8888-8888-8888-888888888888",
      "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
      "contractId": null,
      "parentServiceId": null,
      "origin": "MANUAL",
      "status": "IN_EXECUTION",
      "targetPests": [
        "cucarachas"
      ],
      "scheduledDate": "2026-09-02",
      "windowStart": "09:00:00",
      "windowEnd": "12:00:00",
      "estimatedDurationMinutes": 45,
      "requiredTechnicians": 1,
      "priceCents": 1500000,
      "currency": "ARS",
      "priceListId": "cccccccc-1111-1111-1111-111111111111",
      "isWarrantyVisit": false,
      "warrantyUntil": null,
      "priority": "NORMAL",
      "notesInternal": null,
      "notesForTechnician": "Perro guardián — avisar en portería.",
      "cancellationReason": null,
      "cancelledBillable": null,
      "version": 3,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.post('/v1/services/:id/reopen', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "eeeeeeee-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "SVC-000123",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "serviceLocationId": "88888888-8888-8888-8888-888888888888",
      "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
      "contractId": null,
      "parentServiceId": null,
      "origin": "MANUAL",
      "status": "PENDING_VALIDATION",
      "targetPests": [
        "cucarachas"
      ],
      "scheduledDate": "2026-09-02",
      "windowStart": "09:00:00",
      "windowEnd": "12:00:00",
      "estimatedDurationMinutes": 45,
      "requiredTechnicians": 1,
      "priceCents": 1500000,
      "currency": "ARS",
      "priceListId": "cccccccc-1111-1111-1111-111111111111",
      "isWarrantyVisit": false,
      "warrantyUntil": null,
      "priority": "NORMAL",
      "notesInternal": null,
      "notesForTechnician": "Perro guardián — avisar en portería.",
      "cancellationReason": null,
      "cancelledBillable": null,
      "version": 4,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.post('/v1/services/:id/warranty-visit', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "eeeeeeee-2222-2222-2222-222222222222",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "SVC-000125",
      "customerId": "55555555-5555-5555-5555-555555555555",
      "serviceLocationId": "88888888-8888-8888-8888-888888888888",
      "serviceTypeId": "aaaaaaaa-1111-1111-1111-111111111111",
      "contractId": null,
      "parentServiceId": "eeeeeeee-1111-1111-1111-111111111111",
      "origin": "WARRANTY",
      "status": "DRAFT",
      "targetPests": [
        "cucarachas"
      ],
      "scheduledDate": "2026-09-02",
      "windowStart": "09:00:00",
      "windowEnd": "12:00:00",
      "estimatedDurationMinutes": 45,
      "requiredTechnicians": 1,
      "priceCents": 0,
      "currency": "ARS",
      "priceListId": "cccccccc-1111-1111-1111-111111111111",
      "isWarrantyVisit": true,
      "warrantyUntil": null,
      "priority": "NORMAL",
      "notesInternal": null,
      "notesForTechnician": "Perro guardián — avisar en portería.",
      "cancellationReason": null,
      "cancelledBillable": null,
      "version": 1,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.get('/v1/routes', () =>
    HttpResponse.json({
    "success": true,
    "data": [
      {
        "id": "ffffffff-1111-1111-1111-111111111111",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "code": "RT-000045",
        "technicianId": "22222222-2222-2222-2222-222222222222",
        "vehicleId": null,
        "routeDate": "2026-09-02",
        "status": "DRAFT",
        "publishedAt": null,
        "publishedBy": null,
        "startedAt": null,
        "completedAt": null,
        "notes": null,
        "version": 1,
        "createdAt": "2026-08-27T12:00:00.000Z",
        "updatedAt": "2026-08-27T12:00:00.000Z"
      }
    ]
  }),
  ),
  http.post('/v1/routes', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "ffffffff-2222-2222-2222-222222222222",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "RT-000046",
      "technicianId": "22222222-2222-2222-2222-222222222222",
      "vehicleId": null,
      "routeDate": "2026-09-03",
      "status": "DRAFT",
      "publishedAt": null,
      "publishedBy": null,
      "startedAt": null,
      "completedAt": null,
      "notes": null,
      "version": 1,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z"
    }
  }),
  ),
  http.get('/v1/routes/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "ffffffff-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "RT-000045",
      "technicianId": "22222222-2222-2222-2222-222222222222",
      "vehicleId": null,
      "routeDate": "2026-09-02",
      "status": "DRAFT",
      "publishedAt": null,
      "publishedBy": null,
      "startedAt": null,
      "completedAt": null,
      "notes": null,
      "version": 1,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "stops": [
        {
          "id": "10101010-1111-1111-1111-111111111111",
          "tenantId": "f0000000-0000-4000-8000-000100000000",
          "routeId": "ffffffff-1111-1111-1111-111111111111",
          "serviceId": "eeeeeeee-1111-1111-1111-111111111111",
          "sequence": 1,
          "status": "PENDING",
          "eta": null,
          "travelMinutes": 15,
          "enRouteAt": null,
          "arrivedAt": null,
          "arrivalLat": null,
          "arrivalLng": null,
          "arrivalAccuracyM": null,
          "gpsStatus": null,
          "distanceFromLocationM": null,
          "outcomeReason": null,
          "wastedTrip": false,
          "version": 1,
          "createdAt": "2026-08-27T12:00:00.000Z",
          "updatedAt": "2026-08-27T12:00:00.000Z"
        }
      ]
    }
  }),
  ),
  http.patch('/v1/routes/:id', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "ffffffff-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "RT-000045",
      "technicianId": "22222222-2222-2222-2222-222222222222",
      "vehicleId": null,
      "routeDate": "2026-09-02",
      "status": "DRAFT",
      "publishedAt": null,
      "publishedBy": null,
      "startedAt": null,
      "completedAt": null,
      "notes": "Sale más temprano por lluvia.",
      "version": 2,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "stops": [
        {
          "id": "10101010-1111-1111-1111-111111111111",
          "tenantId": "f0000000-0000-4000-8000-000100000000",
          "routeId": "ffffffff-1111-1111-1111-111111111111",
          "serviceId": "eeeeeeee-1111-1111-1111-111111111111",
          "sequence": 1,
          "status": "PENDING",
          "eta": null,
          "travelMinutes": 15,
          "enRouteAt": null,
          "arrivedAt": null,
          "arrivalLat": null,
          "arrivalLng": null,
          "arrivalAccuracyM": null,
          "gpsStatus": null,
          "distanceFromLocationM": null,
          "outcomeReason": null,
          "wastedTrip": false,
          "version": 1,
          "createdAt": "2026-08-27T12:00:00.000Z",
          "updatedAt": "2026-08-27T12:00:00.000Z"
        }
      ]
    }
  }),
  ),
  http.post('/v1/routes/:id/stops', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "ffffffff-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "RT-000045",
      "technicianId": "22222222-2222-2222-2222-222222222222",
      "vehicleId": null,
      "routeDate": "2026-09-02",
      "status": "DRAFT",
      "publishedAt": null,
      "publishedBy": null,
      "startedAt": null,
      "completedAt": null,
      "notes": null,
      "version": 2,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "stops": [
        {
          "id": "10101010-1111-1111-1111-111111111111",
          "tenantId": "f0000000-0000-4000-8000-000100000000",
          "routeId": "ffffffff-1111-1111-1111-111111111111",
          "serviceId": "eeeeeeee-1111-1111-1111-111111111111",
          "sequence": 1,
          "status": "PENDING",
          "eta": null,
          "travelMinutes": 15,
          "enRouteAt": null,
          "arrivedAt": null,
          "arrivalLat": null,
          "arrivalLng": null,
          "arrivalAccuracyM": null,
          "gpsStatus": null,
          "distanceFromLocationM": null,
          "outcomeReason": null,
          "wastedTrip": false,
          "version": 1,
          "createdAt": "2026-08-27T12:00:00.000Z",
          "updatedAt": "2026-08-27T12:00:00.000Z"
        }
      ]
    }
  }),
  ),
  http.put('/v1/routes/:id/stops/order', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "ffffffff-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "RT-000045",
      "technicianId": "22222222-2222-2222-2222-222222222222",
      "vehicleId": null,
      "routeDate": "2026-09-02",
      "status": "DRAFT",
      "publishedAt": null,
      "publishedBy": null,
      "startedAt": null,
      "completedAt": null,
      "notes": null,
      "version": 3,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "stops": [
        {
          "id": "10101010-1111-1111-1111-111111111111",
          "tenantId": "f0000000-0000-4000-8000-000100000000",
          "routeId": "ffffffff-1111-1111-1111-111111111111",
          "serviceId": "eeeeeeee-1111-1111-1111-111111111111",
          "sequence": 1,
          "status": "PENDING",
          "eta": null,
          "travelMinutes": 15,
          "enRouteAt": null,
          "arrivedAt": null,
          "arrivalLat": null,
          "arrivalLng": null,
          "arrivalAccuracyM": null,
          "gpsStatus": null,
          "distanceFromLocationM": null,
          "outcomeReason": null,
          "wastedTrip": false,
          "version": 1,
          "createdAt": "2026-08-27T12:00:00.000Z",
          "updatedAt": "2026-08-27T12:00:00.000Z"
        }
      ]
    }
  }),
  ),
  http.delete('/v1/routes/:id/stops/:stopId', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "ffffffff-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "RT-000045",
      "technicianId": "22222222-2222-2222-2222-222222222222",
      "vehicleId": null,
      "routeDate": "2026-09-02",
      "status": "DRAFT",
      "publishedAt": null,
      "publishedBy": null,
      "startedAt": null,
      "completedAt": null,
      "notes": null,
      "version": 3,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "stops": []
    }
  }),
  ),
  http.post('/v1/routes/:id/validate', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "canPublish": false,
      "blockers": [
        {
          "code": "ROUTE_TECHNICIAN_LICENSE_EXPIRED",
          "message": "La libreta sanitaria del operario vence antes de la fecha de la ruta.",
          "stopId": null
        }
      ],
      "warnings": [
        {
          "code": "ROUTE_STOP_TIME_OVERLAP",
          "message": "El stop 2 se solapa con la ventana horaria del stop 3.",
          "stopId": "10101010-1111-1111-1111-111111111111"
        }
      ]
    }
  }),
  ),
  http.post('/v1/routes/:id/publish', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "ffffffff-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "RT-000045",
      "technicianId": "22222222-2222-2222-2222-222222222222",
      "vehicleId": null,
      "routeDate": "2026-09-02",
      "status": "PUBLISHED",
      "publishedAt": "2026-08-27T18:00:00.000Z",
      "publishedBy": "11111111-1111-1111-1111-111111111111",
      "startedAt": null,
      "completedAt": null,
      "notes": null,
      "version": 4,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "stops": [
        {
          "id": "10101010-1111-1111-1111-111111111111",
          "tenantId": "f0000000-0000-4000-8000-000100000000",
          "routeId": "ffffffff-1111-1111-1111-111111111111",
          "serviceId": "eeeeeeee-1111-1111-1111-111111111111",
          "sequence": 1,
          "status": "PENDING",
          "eta": null,
          "travelMinutes": 15,
          "enRouteAt": null,
          "arrivedAt": null,
          "arrivalLat": null,
          "arrivalLng": null,
          "arrivalAccuracyM": null,
          "gpsStatus": null,
          "distanceFromLocationM": null,
          "outcomeReason": null,
          "wastedTrip": false,
          "version": 1,
          "createdAt": "2026-08-27T12:00:00.000Z",
          "updatedAt": "2026-08-27T12:00:00.000Z"
        }
      ]
    }
  }),
  ),
  http.post('/v1/routes/:id/unpublish', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "ffffffff-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "RT-000045",
      "technicianId": "22222222-2222-2222-2222-222222222222",
      "vehicleId": null,
      "routeDate": "2026-09-02",
      "status": "DRAFT",
      "publishedAt": null,
      "publishedBy": null,
      "startedAt": null,
      "completedAt": null,
      "notes": null,
      "version": 5,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "stops": [
        {
          "id": "10101010-1111-1111-1111-111111111111",
          "tenantId": "f0000000-0000-4000-8000-000100000000",
          "routeId": "ffffffff-1111-1111-1111-111111111111",
          "serviceId": "eeeeeeee-1111-1111-1111-111111111111",
          "sequence": 1,
          "status": "PENDING",
          "eta": null,
          "travelMinutes": 15,
          "enRouteAt": null,
          "arrivedAt": null,
          "arrivalLat": null,
          "arrivalLng": null,
          "arrivalAccuracyM": null,
          "gpsStatus": null,
          "distanceFromLocationM": null,
          "outcomeReason": null,
          "wastedTrip": false,
          "version": 1,
          "createdAt": "2026-08-27T12:00:00.000Z",
          "updatedAt": "2026-08-27T12:00:00.000Z"
        }
      ]
    }
  }),
  ),
  http.post('/v1/routes/:id/reassign', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "ffffffff-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "RT-000045",
      "technicianId": "33333333-4444-4444-4444-444444444444",
      "vehicleId": null,
      "routeDate": "2026-09-02",
      "status": "DRAFT",
      "publishedAt": null,
      "publishedBy": null,
      "startedAt": null,
      "completedAt": null,
      "notes": null,
      "version": 4,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "stops": [
        {
          "id": "10101010-1111-1111-1111-111111111111",
          "tenantId": "f0000000-0000-4000-8000-000100000000",
          "routeId": "ffffffff-1111-1111-1111-111111111111",
          "serviceId": "eeeeeeee-1111-1111-1111-111111111111",
          "sequence": 1,
          "status": "PENDING",
          "eta": null,
          "travelMinutes": 15,
          "enRouteAt": null,
          "arrivedAt": null,
          "arrivalLat": null,
          "arrivalLng": null,
          "arrivalAccuracyM": null,
          "gpsStatus": null,
          "distanceFromLocationM": null,
          "outcomeReason": null,
          "wastedTrip": false,
          "version": 1,
          "createdAt": "2026-08-27T12:00:00.000Z",
          "updatedAt": "2026-08-27T12:00:00.000Z"
        }
      ]
    }
  }),
  ),
  http.post('/v1/routes/:id/cancel', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "ffffffff-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "code": "RT-000045",
      "technicianId": "22222222-2222-2222-2222-222222222222",
      "vehicleId": null,
      "routeDate": "2026-09-02",
      "status": "CANCELLED",
      "publishedAt": null,
      "publishedBy": null,
      "startedAt": null,
      "completedAt": null,
      "notes": null,
      "version": 4,
      "createdAt": "2026-08-27T12:00:00.000Z",
      "updatedAt": "2026-08-27T12:00:00.000Z",
      "stops": [
        {
          "id": "10101010-1111-1111-1111-111111111111",
          "tenantId": "f0000000-0000-4000-8000-000100000000",
          "routeId": "ffffffff-1111-1111-1111-111111111111",
          "serviceId": "eeeeeeee-1111-1111-1111-111111111111",
          "sequence": 1,
          "status": "PENDING",
          "eta": null,
          "travelMinutes": 15,
          "enRouteAt": null,
          "arrivedAt": null,
          "arrivalLat": null,
          "arrivalLng": null,
          "arrivalAccuracyM": null,
          "gpsStatus": null,
          "distanceFromLocationM": null,
          "outcomeReason": null,
          "wastedTrip": false,
          "version": 1,
          "createdAt": "2026-08-27T12:00:00.000Z",
          "updatedAt": "2026-08-27T12:00:00.000Z"
        }
      ]
    }
  }),
  ),
  http.post('/v1/field/sessions/:id/evidence/upload-url', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "uploadUrl": "https://storage.fumibug.internal/signed/abc123",
      "storagePath": "tenants/f0000000-0000-4000-8000-000100000000/evidence/2026/08/27/xyz.webp",
      "expiresAt": "2026-08-27T13:00:00.000Z"
    }
  }),
  ),
  http.post('/v1/field/sessions/:id/evidence', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "id": "20202020-1111-1111-1111-111111111111",
      "tenantId": "f0000000-0000-4000-8000-000100000000",
      "serviceSessionId": "30303030-1111-1111-1111-111111111111",
      "type": "PHOTO",
      "category": "BEFORE",
      "storagePath": "tenants/f0000000-0000-4000-8000-000100000000/evidence/2026/08/27/xyz.webp",
      "mimeType": "image/webp",
      "sizeBytes": 245678,
      "width": 1280,
      "height": 960,
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "takenAt": "2026-08-27T12:50:00.000Z",
      "uploadedAt": "2026-08-27T12:51:00.000Z",
      "lat": -34.6037,
      "lng": -58.3816,
      "accuracyM": 8.5,
      "clientEventId": "40404040-1111-1111-1111-111111111111"
    }
  }),
  ),
  http.get('/v1/reports/dashboard-admin', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "servicesTodayByStatus": {
        "SCHEDULED": 3,
        "DISPATCHED": 2,
        "IN_EXECUTION": 1,
        "COMPLETED": 4
      },
      "activeTechniciansCount": 3,
      "unassignedServicesCount": 1,
      "alerts": [
        {
          "type": "LICENSE_EXPIRING",
          "message": "La libreta sanitaria de Diego Operario vence en 25 días.",
          "entityId": "22222222-2222-2222-2222-222222222222",
          "severity": "WARNING"
        }
      ],
      "collectedTodayCashCents": 4500000,
      "collectedTodayTransferCents": 1200000
    }
  }),
  ),
  http.get('/v1/reports/dashboard-owner', () =>
    HttpResponse.json({
    "success": true,
    "data": {
      "billedThisMonthCents": 850000000,
      "cashPendingReconciliationCents": 3200000,
      "completedServicesThisMonth": 142,
      "averageTicketCents": 1450000
    }
  }),
  ),
  http.get('/v1/audit-logs', () =>
    HttpResponse.json({
    "success": true,
    "data": [
      {
        "id": "10245",
        "tenantId": "f0000000-0000-4000-8000-000100000000",
        "actorUserId": "11111111-1111-1111-1111-111111111111",
        "actorRole": "owner",
        "action": "route.publish",
        "entityType": "route",
        "entityId": "ffffffff-1111-1111-1111-111111111111",
        "before": {
          "status": "DRAFT"
        },
        "after": {
          "status": "PUBLISHED"
        },
        "diff": null,
        "severity": "INFO",
        "ip": "190.191.10.20",
        "userAgent": "Mozilla/5.0",
        "requestId": "50505050-1111-1111-1111-111111111111",
        "createdAt": "2026-08-27T18:00:00.000Z"
      }
    ]
  }),
  ),
];
