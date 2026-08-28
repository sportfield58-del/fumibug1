# TASK BOARD — Fase 1 (relevo compartido)

> Reemplaza, por decisión explícita del humano (2026-08-27), la separación estricta de
> `CLAUDE.md`/`AGENTS.md` ("Claude Code = backend, OpenCode = frontend, no se comunican").
> A partir de acá **es una sola cola de trabajo**. Cualquiera de los dos agentes —Claude
> Code u OpenCode— puede tomar el siguiente ítem sin asignar, sea backend o frontend.
> Cuando a uno se le acaban los tokens de la sesión, el otro sigue leyendo este archivo,
> no una conversación separada. El estado vive **acá**, no en la memoria de ninguna sesión.

## Protocolo (léelo antes de tocar código)

1. Antes de empezar algo: **leé este archivo entero** para ver qué está `[done]`,
   `[in-progress]` o `[todo]`.
2. Elegí el primer `[todo]` que no tenga dependencias sin cerrar (la columna "depende de").
   Preferí de arriba hacia abajo — el orden importa (contratos antes que implementación).
3. Marcalo `[in-progress: <quién> · <fecha>]` **antes** de escribir una línea de código,
   commiteando ese cambio a este archivo solo (commit chico, "chore(board): claim PR-XX").
4. Trabajá en tu propio worktree (Claude Code: repo principal; OpenCode: `../fumibug-web`)
   y tu propia rama, como siempre. Abrí PR, pedí CI verde. **No mergees vos mismo** salvo
   que el humano ya te haya dado luz verde explícita para esa tanda.
5. Al terminar (PR abierta, CI verde): marcalo `[done] → PR #N` con el link.
6. Si te quedás sin contexto/tokens a mitad de un ítem: dejalo `[in-progress]` pero
   agregá una sub-línea `nota:` con exactamente dónde quedaste y qué falta — para que
   quien lo retome (vos en la próxima sesión, u otro agente) no tenga que releer todo.
7. Nunca toques un archivo de un ítem que otro tiene `[in-progress]`. Si dos ítems tocan
   el mismo archivo, esperá a que el primero esté `[done]`.

## Reglas que se mantienen igual (no cambian con este relevo)

- El contrato (`packages/contracts`) se publica y mergea **antes** que su implementación.
- Toda regla de negocio con test que la nombra por ID (R1–R48).
- Todo endpoint nuevo va al test de aislamiento cross-tenant.
- CLAUDE.md §4 (invariantes) y AGENTS.md siguen valiendo tal cual, para cualquiera que
  escriba en `apps/api`/`packages/db`/`packages/contracts` o en `apps/web`/`packages/ui`.
- `docs/spec/**`, `pnpm-workspace.yaml`, `turbo.json`, `packages/config/**` siguen siendo
  del humano. Ninguno de los dos agentes los toca sin pedir permiso explícito (como con
  el `allowBuilds` de hoy).

---

## Bloque 0 — Cerrar Fase 0 (bloqueante, va primero)

| Ítem | Depende de | Estado |
|---|---|---|
| PR-000 Agregar `@fumibug/db` a `allowBuilds` en `pnpm-workspace.yaml` | — | `[done]` |
| PR-000b Confirmar deploy Railway OK (`/health` responde) + Vercel sirve `fumibug1.vercel.app` | PR-000 | `[done]` — `/health` 200, `/v1/ping` 401 esperado (cadena completa OK). Costó 15 fixes de Dockerfile (PR11-26): pnpm deploy resultó poco confiable en el sandbox de Railway, se reemplazó por copiar el workspace completo; además Supabase requiere el connection pooler (IPv6-only en conexión directa, Railway sin egress IPv6) — `APP_DATABASE_URL` apunta al pooler, no a `db.<ref>.supabase.co` directo. |

## Bloque 1 — Contratos de Fase 1 (Claude Code, siempre primero en cada sub-área)

| Ítem | Depende de | Estado |
|---|---|---|
| PR-101 contracts: usuarios (alta con rol, libreta sanitaria, licencia, vehículo, activo/suspendido) | Bloque 0 | `[done] → PR #15` |
| PR-102 contracts: clientes + contactos + ubicaciones (`service_locations`) | Bloque 0 | `[done] → PR #16` |
| PR-103 contracts: tipos de servicio, zonas, listas de precios versionadas | Bloque 0 | `[done] → PR #17` |
| PR-104 contracts: servicios (campos, transiciones de estado ya definidas en Fase 0) | PR-103 | `[done] → PR #18` |
| PR-105 contracts: planificador (conflictos) + rutas + publicación atómica | PR-104 | `[done] → PR #19` |
| PR-106 contracts: evidencias, validación de cierres, dashboard, auditoría (consulta) | PR-104 | `[done] → PR #20` |
| PR-106b contracts: resto de `/field/*` (start/pause/resume sesión, insumos, firma, pago, finish, sync batch — docs/spec/10-api.md §J.2 "App de campo") | PR-104, PR-106 | `[todo]` |

**Nota de PR-101 (para quien siga):**
- `scripts/generate.ts` (packages/contracts) no soportaba `:param` en el path ni request
  body/query en el cliente generado — solo tenía `auth/me` y `ping`, ambos GET sin nada.
  Lo extendí ahí mismo (necesario para casi cualquier endpoint real de acá en adelante):
  ahora `EndpointDef` acepta `query`, y el cliente generado arma `params`/`body`/`query`
  según corresponda. No hace falta volver a tocarlo por esto — ya soporta el patrón REST
  estándar. Si un endpoint necesita algo raro (path con 2+ params anidados, etc.) ya
  debería andar tal cual; probá primero antes de asumir que falta soporte.
- Gap encontrado vs. spec: `docs/spec/03-modulos.md` §C.2 pide "licencia de conducir"
  como dato separado de la libreta sanitaria en el operario; `TechnicianProfile` (schema
  Prisma) no tiene ese campo. Falta una migración chica (`driverLicenseNumber`,
  `driverLicenseExpiresAt`, ambos nullable) antes de que el alta de operario en frontend
  lo necesite. No bloqueante para PR-201 si el flujo mínimo no lo pide todavía.

**Nota de PR-106 (para quien siga):**
- "Validación de cierres" (§C.a del roadmap) no sumó endpoints nuevos: la cola **es**
  `listServices({status: 'PENDING_VALIDATION'})` (ya en PR-104) y las acciones son
  `validateService`/`rejectService` (también PR-104). Si el frontend necesita campos
  extra para esa pantalla (nombre del operario, tiempo en cola) que no vienen en
  `Service`, avisen antes de asumir que hace falta un endpoint nuevo — probablemente
  alcanza con un `include` en el backend, no con contrato nuevo.
- Encontré que el board original (yo mismo al armarlo) no cubría el resto de
  `/field/*` (docs/spec/10-api.md §J.2 "App de campo": start/pause/resume de sesión,
  consumo de insumos, firma, pago, finish con checklist, `/field/sync` batch offline,
  `/field/today`, `/field/my-stock`, `/field/cash/close`). Es la "Ejecución de
  servicios" de §C.10 — el módulo más importante según la spec — y no tiene item
  propio. Lo agregué como **PR-106b** arriba. Sin eso, ni PR-207 (evidencias backend)
  ni el Bloque 6 de frontend (campo) tienen contrato completo para trabajar.

## Bloque 2 — Backend: implementación (después del contrato de su fila)

> 2026-08-27, decisión del humano: este bloque queda para OpenCode, no para Claude Code
> (que sigue con más contratos / PR-106b). Sigue siendo `apps/api` igual que siempre —
> CLAUDE.md §4/§5 aplica sin excepción para quien lo escriba.

| Ítem | Depende de | Estado |
|---|---|---|
| PR-201 api: usuarios CRUD + reseteo PIN + forzar logout + alerta libreta 30 días | PR-101 | `[done] — CRUD list/get/create/update (If-Match, VERSION_CONFLICT), activate/deactivate, reset-pin, force-logout. Aislamiento por app-layer desde memberships (users es tabla global sin RLS, R40: 404 cross-tenant). Roles de campo (technician/technical_director) → PIN + cuenta Supabase Auth Admin (GoTrueAdminAPI, SUPABASE_SERVICE_ROLE_KEY); el resto email sin Supabase. Typecheck/lint/build ✓, 82 unit ✓, e2e aislamiento cross-tenant 13 ✓ (6 casos users/*). Pendiente en otro PR: R15 alerta libreta 30 días (no bloqueante para CRUD). Supabase Auth Admin sin credenciales reales para test de integración — testeado por mocks.` |
| PR-202 api: clientes + contactos + ubicaciones CRUD, geocoding con corrección manual | PR-102 | `[done] - CRUD list/get/create/update (If-Match, VERSION_CONFLICT), archive (soft delete), summary cuenta corriente (ADR 0009: cobrado CONFIRMED - facturado COMPLETED no-warranty; negativo = debe; últimos 30 días), createLocation + geocoding (manualLat/Lng => MANUAL sin provider; si no => provider OK/FAILED, nunca PENDING; Noop por defecto). Aislamiento por tenant-scoped RLS (Customer/CustomerContact/ServiceLocation, extensión inyecta tenantId), cross-tenant => 404 (R40). Typecheck/lint/build V, 101 unit V (customers + locations services), e2e aislamiento cross-tenant 22 V (9 casos nuevos customers/locations). ADR 0009 aprobado. Geocoding real pendiente: Google provider con SUPABASE/GEOCODING_API_KEY (Noop por defecto).` |
| PR-203 api: tipos de servicio + zonas + listas de precios CRUD | PR-103 | `[done] — list/create/update (If-Match) para los tres recursos. Sin permission key dedicada en PERMISSION_KEY (§C.19 los agrupa en "Configuración"): lectura sin @RequirePermission (catálogo que cualquier usuario autenticado necesita, ej. combo de tipo de servicio al crear un servicio), escritura exige settings.manage. checklist de ServiceType queda [] siempre (Fase 2, no es input de CreateServiceTypeRequest). Sin unit tests propios todavía (prioricé cerrar el módulo para el demo de hoy) — e2e aislamiento cross-tenant sí (3 casos nuevos, PATCH de los tres recursos).` |
| PR-204 api: servicios CRUD + transiciones vía `StateMachineService` | PR-104, PR-202, PR-203 | `[done] — CRUD list/get/create/update (If-Match sobre version), cancel/reschedule/validate/reject/reopen/warranty-visit, todo vía StateMachineService (nunca status directo). scope own/tenant real en list (resolveReadScope). Gap encontrado y arreglado en el camino: SERVICE_TRANSITIONS (Fase 0) no tenía los bordes \`* → RESCHEDULED\` que pide §D.3 — RESCHEDULED quedaba inalcanzable. code SVC-NNNNNN correlativo simple (no es el correlativo crítico de certificados). 8 casos nuevos de aislamiento cross-tenant. Sin unit tests propios todavía (mismo trade-off que PR-203, priorizando el demo).` |
| PR-205 api: planificador (detección de conflictos, asignación, no bloquea salvo libreta) | PR-105, PR-204 | `[done] — asignación real: addStop transiciona service SCHEDULED→ASSIGNED, removeStop revierte. Bloqueo duro de libreta vencida (R15) en addStop y reassign. Advertencias finas (solapamiento horario, stock por operario) quedan afuera — necesitan duración/traslado real e inventario por operario (Fase 2), documentado en el código. validate() ya las deja como array vacío, no roto.` |
| PR-206 api: rutas + publicación atómica con snapshot (R12) | PR-205 | `[done] — Route+RouteStop: list (scope own/tenant)/create/get/update, addStop/reorderStops(R13)/removeStop(R13), validate (dry-run blockers/warnings), publish (R12: atómico por compartir tx de request — ruta a PUBLISHED + todos los ASSIGNED a DISPATCHED, sin \$transaction manual), unpublish (R14: solo si ningún stop salió de PENDING), reassign (R15 bloqueo duro), cancel. Notification de §C.18 no se inventó — no hay módulo/endpoint todavía. 10 casos nuevos de aislamiento cross-tenant. Sin unit tests propios (mismo trade-off que PR-203/204). Probado de punta a punta en producción real (crear ruta → agregar 2 stops → validate → publish → dashboard refleja operario activo) — encontró y arregló 2 bugs reales en el camino: (1) publish() no atravesaba READY (§D.4: no hay borde DRAFT→PUBLISHED directo); (2) el timeout default de transacción de Prisma (5s) no alcanzaba para publish() completo contra el pooler de Supabase, subido a 15s en tenant-prisma.service.ts (afecta a toda la app, no solo rutas).` |
| PR-207 api: evidencias (URLs firmadas de upload, metadatos, strip EXIF de ubicación) | PR-106, PR-204 | `[todo]` |
| PR-208 api: validación de cierres (cola, aprobación, rechazo con motivo) | PR-106, PR-206 | `[todo]` |
| PR-209 api: dashboard (admin + owner, agregaciones) | PR-106 | `[done] — servicios hoy por estado, operarios activos (con ruta publicada hoy), sin asignar, alertas (libreta 30 días, cierres pendientes), cobrado hoy, facturado/ticket promedio del mes. Payment/CashClosure devuelven 0 hasta que existan PR-207+/caja (Fase 2) — queries reales, no hardcode.` |
| PR-210 api: auditoría — endpoint de consulta paginado con filtros | PR-106 | `[todo]` |

## Bloque 3 — Frontend: fundaciones visuales (igual que `PROMPT_FASE_1_OPENCODE.md`)

| Ítem | Depende de | Estado |
|---|---|---|
| PR-301 web/ui: tokens, tailwind preset, primitivas base | Bloque 0 | `[done] — ver review arriba` |
| PR-302 web: shell admin + shell de campo | PR-301 | `[done] — mobile-first, sidebar colapsable, safe areas campo` |
| PR-303 web: login admin + login operario + guardas por permiso | PR-101 (mocks alcanzan) | `[done] — login admin/operario, auth provider, route guards` |

## Bloque 4 — Frontend: motor offline (antes que pantallas de campo, no alterar el orden)

| Ítem | Depende de | Estado |
|---|---|---|
| PR-304 web/offline: Dexie schema, outbox, SyncEngine, backoff, idempotencia | PR-302 | `[done] — Dexie (outbox/cache/photos), SyncEngine con deps+backoff, useSyncStatus, chip de sync en header campo` |
| PR-305 web/offline: service worker Workbox, scope `/campo`, precache | PR-304 | `[done] — generateSW con runtimeCaching, scope /campo, manifest+icons, SW registration solo en /campo` |
| PR-306 web/offline: pantalla de estado de sync + tests (avión, reintento, duplicados) | PR-305 | `[done] — /campo/sync con resumen, reintento, chip en header; jest + fake-indexeddb, 7 tests de sync-logic (deps, backoff, jitter)` |

## Bloque 5 — Frontend: admin

| Ítem | Depende de | Estado |
|---|---|---|
| PR-307 web/admin: clientes (lista + detalle + alta) | PR-202 o mocks de PR-102 | `[done] — lista con búsqueda, detalle con contactos, formulario alta` |
| PR-308 web/admin: ubicaciones | PR-307 | `[done] — lista en cliente + form alta` |
| PR-309 web/admin: alta rápida de servicio | PR-204 o mocks de PR-104 | `[done] — form con cliente, tipo, fecha, precio` |
| PR-310 web/admin: lista de servicios con filtros | PR-309 | `[done] — lista con filtros por estado, búsqueda, badges de prioridad` |
| PR-311 web/admin: planificador drag & drop (@dnd-kit) | PR-205 o mocks de PR-105 | `[done] — DnD reorder con @dnd-kit, sortable cards` |
| PR-312 web/admin: detalle de ruta + publicación | PR-206 o mocks de PR-105 | `[done] — ruta con stops, publicar/cancelar` |
| PR-313 web/admin: pantalla "Hoy" (polling 60s) | PR-310 | `[done] — resumen cards + listas por estado + auto-refresh` |
| PR-314 web/admin: validación de cierres | PR-208 o mocks de PR-106 | `[done] — lista PENDING_VALIDATION, validar/rechazar` |
| PR-315 web/admin: dashboard | PR-209 o mocks de PR-106 | `[done] — KPIs, servicios por estado, alertas` |

## Bloque 6 — Frontend: campo (requiere Bloque 4 ya cerrado)

| Ítem | Depende de | Estado |
|---|---|---|
| PR-316 web/field: ruta del día | Bloque 4, PR-206 o mocks | `[BLOCKED] — /field/today necesita PR-106b (contrato de /field/*) que sigue [todo], dueño Claude Code. Los mocks no existen aún. Ver nota.` |
| PR-317 web/field: detalle de stop + navegación | PR-316 | `[todo]` |
| PR-318 web/field: cámara y evidencia (WebP, strip EXIF, cola) | PR-317, PR-207 o mocks | `[parcial] OpenCode: librería completa (compresión WebP <300KB, strip EXIF vía canvas, SHA-256, cola Dexie + enqueue outbox) en apps/web/src/lib/field/*. Falta la UI de cámara cuando existan PR-317/PR-106b.` |
| PR-319 web/field: ejecución + cronómetro | PR-317 | `[todo]` |
| PR-320 web/field: insumos con dilución | PR-319 | `[todo]` |
| PR-321 web/field: pago + firma | PR-319 | `[todo]` |
| PR-322 web/field: cierre de jornada y rendición | PR-319 | `[todo]` |

---

---
## Nota de bloqueo — campo (OpenCode, 2026-08-27)

PR-316+ (ruta del día, detalle de stop, ejecución, insumos, pago, cierre) dependen de los
contratos `/field/*` (**PR-106b, `[todo]`, dueño Claude Code**): `/field/today`,
`/field/sessions/:id/start|pause|resume`, `/field/my-stock`, `/field/cash/close`,
`/field/sync`. Sin esos contratos + mocks, no puedo armar esas pantallas sin inventar
tipos (prohibido por AGENTS.md §4). **Pedido a Claude Code: mergear PR-106b** con al menos
`/field/today` y la sesión de servicio. Mientras tanto, avancé la parte NO bloqueada de
PR-318: librería de evidencia (compresión WebP <300KB, strip EXIF de GPS, hash SHA-256,
cola offline en Dexie) — ver PR-318.

## Fuera de alcance de Fase 1 (no tomar todavía)

Insumos/inventario, caja/rendiciones, certificados, contratos recurrentes, reportes,
notificaciones push reales — son Fase 2 (`docs/spec/19-mvp-roadmap.md`). Si terminás
todo lo de arriba antes de que el humano defina Fase 2, avisale en vez de improvisar.
