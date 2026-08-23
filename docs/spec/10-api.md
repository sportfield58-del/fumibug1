<!-- Extraído de docs/MASTER_SPEC.md · secciones §J -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## J. API REST

### J.1 Convenciones

- Base: `https://api.fumibug.app/v1`. **Versión en el path desde el día 1.**
- Auth: `Authorization: Bearer <access_token>` (JWT de Supabase, verificado por JWKS).
- Tenant: se toma **del token** (claim `tenant_id`), nunca de un header o del body. Un header `X-Tenant-Id` sería un agujero de seguridad.
- Idempotencia: header `Idempotency-Key` en todo `POST` mutante originado en el campo.
- Concurrencia: header `If-Match: <version>` en `PUT`/`PATCH` de entidades versionadas → `409` si no coincide.
- Paginación: cursor (`?cursor=&limit=`) en listas de alto volumen; offset solo donde hace falta salto a página.
- Formato de respuesta:

```jsonc
// éxito
{ "success": true, "data": {...}, "meta": { "cursor": "...", "hasMore": true } }
// error
{ "success": false, "error": { "code": "ROUTE_HAS_STARTED_STOPS",
  "message": "No se puede despublicar: 2 servicios ya comenzaron.",
  "details": [{ "field": "stopIds", "value": ["..."] }] },
  "requestId": "01J..." }
```

- Códigos: `400` validación · `401` sin token/expirado · `403` sin permiso · `404` no existe **o no es de tu tenant** · `409` conflicto de estado o versión · `422` regla de negocio violada · `429` rate limit · `500` con `requestId`.
- Los `error.code` son un enum estable y documentado. **El frontend nunca parsea `message`.**

### J.2 Endpoints

**Auth**
| Método | Endpoint | Qué hace | Rol |
|---|---|---|---|
| POST | `/auth/login` | Email/username + password/PIN → tokens | público |
| POST | `/auth/refresh` | Rotación de refresh token | público |
| POST | `/auth/logout` | Revoca refresh | auth |
| GET | `/auth/me` | Usuario, tenant, rol, permisos efectivos | auth |
| POST | `/auth/password-reset` | Inicia recupero | público (rate limit fuerte) |
| POST | `/auth/pin` | Cambia PIN propio | auth |

**Clientes / ubicaciones**
`GET|POST /customers` · `GET|PATCH /customers/:id` · `POST /customers/:id/archive` · `GET /customers/:id/summary` (cuenta corriente + próximos servicios) · `GET|POST /customers/:id/locations` · `GET|PATCH /locations/:id` · `POST /locations/:id/geocode`

**Contratos**
`GET|POST /contracts` · `GET|PATCH /contracts/:id` · `POST /contracts/:id/pause` · `POST /contracts/:id/cancel` · `POST /contracts/:id/generate` (fuerza generación manual, idempotente)

**Servicios**
| Método | Endpoint | Qué hace | Permiso |
|---|---|---|---|
| GET | `/services?status=&from=&to=&customerId=&technicianId=&unassigned=true` | Lista filtrada | `service.read.*` |
| POST | `/services` | Crea | `service.create` |
| GET | `/services/:id` | Detalle con sesión, evidencia, insumos, pagos | `service.read.*` |
| PATCH | `/services/:id` | Edita (requiere `If-Match`) | `service.update` |
| POST | `/services/:id/cancel` | `{reason, billable}` | `service.cancel` |
| POST | `/services/:id/reschedule` | `{newDate, reason}` | `service.reschedule` |
| POST | `/services/:id/validate` | Aprueba cierre | `service.validate` |
| POST | `/services/:id/reject` | `{reason}` → vuelve a ejecución | `service.reject` |
| POST | `/services/:id/reopen` | `{reason}` — anula certificado | `session.reopen` |
| POST | `/services/:id/warranty-visit` | Genera revisita sin cargo | `service.create` |

**Rutas**
| Método | Endpoint | Qué hace | Permiso |
|---|---|---|---|
| GET | `/routes?date=&technicianId=&status=` | | `route.read.*` |
| POST | `/routes` | `{technicianId, date}` | `route.create` |
| GET | `/routes/:id` | Con stops ordenados | `route.read.*` |
| PATCH | `/routes/:id` | `If-Match` | `route.update` |
| POST | `/routes/:id/stops` | Agrega servicio a la ruta | `route.update` |
| PUT | `/routes/:id/stops/order` | `{stopIds:[...]}` reordena en una transacción | `route.update` |
| DELETE | `/routes/:id/stops/:stopId` | Quita (solo `PENDING`) | `route.update` |
| POST | `/routes/:id/validate` | **Dry-run de los guards.** Devuelve qué falta sin publicar | `route.read` |
| POST | `/routes/:id/publish` | Transacción atómica §I.R12 | `route.publish` |
| POST | `/routes/:id/unpublish` | | `route.unpublish` |
| POST | `/routes/:id/reassign` | `{newTechnicianId}` | `route.update` |
| POST | `/routes/:id/cancel` | | `route.cancel` |

**App de campo** — endpoints diseñados para offline
| Método | Endpoint | Qué hace |
|---|---|---|
| GET | `/field/today` | **Bundle completo del día**: ruta, stops, clientes, ubicaciones, historial, stock del operario, catálogo de insumos. Una sola llamada, cacheable, con `ETag`. Es lo que el service worker descarga al publicarse la ruta. |
| GET | `/field/routes/:id` | Refresco de una ruta |
| POST | `/field/stops/:id/en-route` | `{occurredAt, lat, lng, accuracy, gpsStatus, clientEventId}` |
| POST | `/field/stops/:id/arrive` | idem |
| POST | `/field/stops/:id/no-show` | `{reason, evidenceIds, clientEventId}` |
| POST | `/field/stops/:id/inaccessible` | `{reason, evidenceIds, clientEventId}` |
| POST | `/field/services/:id/start` | Abre sesión → `201` con sesión |
| POST | `/field/sessions/:id/pause` · `/resume` | |
| POST | `/field/sessions/:id/supplies` | Registra consumo (genera movimiento de inventario) |
| DELETE | `/field/sessions/:id/supplies/:usageId` | Solo con sesión abierta |
| POST | `/field/sessions/:id/evidence/upload-url` | Devuelve URL firmada de Supabase Storage + `storagePath` |
| POST | `/field/sessions/:id/evidence` | Confirma la subida y crea el registro |
| POST | `/field/sessions/:id/signature` | |
| POST | `/field/sessions/:id/payment` | |
| POST | `/field/sessions/:id/finish` | Valida checklist → `422` con lista exacta de faltantes |
| POST | `/field/sync` | **Batch**: array de eventos encolados, procesados en orden con idempotencia. Devuelve resultado por evento. |
| GET | `/field/my-stock` | Stock del vehículo del operario |
| POST | `/field/cash/close` | Rendición |

**Inventario**
`GET /supplies` · `POST /supplies` · `PATCH /supplies/:id` · `GET /inventory?locationId=` · `GET /inventory/movements?...` · `POST /inventory/transfer` · `POST /inventory/adjust` · `POST /inventory/purchase` · `GET /inventory/alerts`

**Dinero**
`GET /payments?...` · `POST /payments` · `POST /payments/:id/void` · `GET /cash/accounts` · `GET /cash/accounts/:id/movements` · `GET /cash/closures?status=` · `POST /cash/closures/:id/reconcile` (`{receivedCents, differenceReason}`) · `POST /cash/adjust`

**Certificados**
`GET /certificates?...` · `POST /certificates` (`{serviceId}`) · `POST /certificates/batch` · `POST /certificates/:id/sign` · `POST /certificates/:id/void` · `GET /certificates/:id/pdf` (redirect a URL firmada, TTL 5 min) · `POST /certificates/:id/send` · **`GET /public/verify/:token`** (sin auth, rate-limited: muestra número, fecha, cliente y estado — nada más)

**Reportes** — `GET /reports/:key?from=&to=&...` con `?format=json|csv|xlsx`. Si el resultado supera 5.000 filas, devuelve `202` con `jobId` y se descarga después.

**Admin** — `/users`, `/roles`, `/settings`, `/audit-logs`, `/notifications`, `/push/subscribe`

### J.3 Ejemplo completo: publicar ruta

```http
POST /v1/routes/9f3a.../publish
Authorization: Bearer eyJ...
Idempotency-Key: 7c1e...
If-Match: 4
```
```jsonc
// 200
{ "success": true, "data": {
  "route": { "id":"9f3a...", "status":"PUBLISHED", "version":5, "publishedAt":"2026-08-21T11:04:12Z" },
  "servicesUpdated": 7, "notificationSent": true } }

// 422 — guards no cumplidos
{ "success": false, "error": {
  "code": "ROUTE_VALIDATION_FAILED",
  "message": "La ruta no cumple los requisitos para publicarse.",
  "details": [
    { "code":"TECHNICIAN_LICENSE_EXPIRED", "message":"La libreta sanitaria de Juan Pérez venció el 2026-08-10." },
    { "code":"INSUFFICIENT_STOCK", "message":"Falta Cipermetrina 25%: requiere 2.4 L, hay 0.8 L.",
      "value": { "supplyId":"...", "required":2.4, "available":0.8 } }
  ] } }

// 409 — otro admin la modificó
{ "success": false, "error": { "code":"VERSION_CONFLICT",
  "message":"La ruta fue modificada por Ana López hace 40 segundos.",
  "details":[{ "currentVersion":5 }] } }
```

### J.4 Contrato compartido

Todos los DTOs se definen **una sola vez** con Zod en `packages/contracts`, y de ahí salen: validación en NestJS (pipe), tipos de TypeScript (`z.infer`), tipos del cliente frontend, mocks de MSW, y el OpenAPI generado. **El frontend nunca redefine un tipo de la API.** Esta es la regla que evita que Claude Code y OpenCode diverjan (§V).

---
