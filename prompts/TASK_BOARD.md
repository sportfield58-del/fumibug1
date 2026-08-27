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
| PR-000 Agregar `@fumibug/db` a `allowBuilds` en `pnpm-workspace.yaml` | — | `[in-progress: humano · 2026-08-27]` |
| PR-000b Confirmar deploy Railway OK (`/health` responde) + Vercel sirve `fumibug1.vercel.app` | PR-000 | `[todo]` |

## Bloque 1 — Contratos de Fase 1 (Claude Code, siempre primero en cada sub-área)

| Ítem | Depende de | Estado |
|---|---|---|
| PR-101 contracts: usuarios (alta con rol, libreta sanitaria, licencia, vehículo, activo/suspendido) | Bloque 0 | `[done] → PR #15` |
| PR-102 contracts: clientes + contactos + ubicaciones (`service_locations`) | Bloque 0 | `[done] → PR #16` |
| PR-103 contracts: tipos de servicio, zonas, listas de precios versionadas | Bloque 0 | `[done] → PR #17` |
| PR-104 contracts: servicios (campos, transiciones de estado ya definidas en Fase 0) | PR-103 | `[todo]` |
| PR-105 contracts: planificador (conflictos) + rutas + publicación atómica | PR-104 | `[todo]` |
| PR-106 contracts: evidencias, validación de cierres, dashboard, auditoría (consulta) | PR-104 | `[todo]` |

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

## Bloque 2 — Backend: implementación (después del contrato de su fila)

| Ítem | Depende de | Estado |
|---|---|---|
| PR-201 api: usuarios CRUD + reseteo PIN + forzar logout + alerta libreta 30 días | PR-101 | `[todo]` |
| PR-202 api: clientes + contactos + ubicaciones CRUD, geocoding con corrección manual | PR-102 | `[todo]` |
| PR-203 api: tipos de servicio + zonas + listas de precios CRUD | PR-103 | `[todo]` |
| PR-204 api: servicios CRUD + transiciones vía `StateMachineService` | PR-104, PR-202, PR-203 | `[todo]` |
| PR-205 api: planificador (detección de conflictos, asignación, no bloquea salvo libreta) | PR-105, PR-204 | `[todo]` |
| PR-206 api: rutas + publicación atómica con snapshot (R12) | PR-205 | `[todo]` |
| PR-207 api: evidencias (URLs firmadas de upload, metadatos, strip EXIF de ubicación) | PR-106, PR-204 | `[todo]` |
| PR-208 api: validación de cierres (cola, aprobación, rechazo con motivo) | PR-106, PR-206 | `[todo]` |
| PR-209 api: dashboard (admin + owner, agregaciones) | PR-106 | `[todo]` |
| PR-210 api: auditoría — endpoint de consulta paginado con filtros | PR-106 | `[todo]` |

## Bloque 3 — Frontend: fundaciones visuales (igual que `PROMPT_FASE_1_OPENCODE.md`)

| Ítem | Depende de | Estado |
|---|---|---|
| PR-301 web/ui: tokens, tailwind preset, primitivas base | Bloque 0 | `[todo]` |
| PR-302 web: shell admin + shell de campo | PR-301 | `[todo]` |
| PR-303 web: login admin + login operario + guardas por permiso | PR-101 (mocks alcanzan) | `[todo]` |

## Bloque 4 — Frontend: motor offline (antes que pantallas de campo, no alterar el orden)

| Ítem | Depende de | Estado |
|---|---|---|
| PR-304 web/offline: Dexie schema, outbox, SyncEngine, backoff, idempotencia | PR-302 | `[todo]` |
| PR-305 web/offline: service worker Workbox, scope `/campo`, precache | PR-304 | `[todo]` |
| PR-306 web/offline: pantalla de estado de sync + tests (avión, reintento, duplicados) | PR-305 | `[todo]` |

## Bloque 5 — Frontend: admin

| Ítem | Depende de | Estado |
|---|---|---|
| PR-307 web/admin: clientes (lista + detalle + alta) | PR-202 o mocks de PR-102 | `[todo]` |
| PR-308 web/admin: ubicaciones | PR-307 | `[todo]` |
| PR-309 web/admin: alta rápida de servicio | PR-204 o mocks de PR-104 | `[todo]` |
| PR-310 web/admin: lista de servicios con filtros | PR-309 | `[todo]` |
| PR-311 web/admin: planificador drag & drop (@dnd-kit) | PR-205 o mocks de PR-105 | `[todo]` |
| PR-312 web/admin: detalle de ruta + publicación | PR-206 o mocks de PR-105 | `[todo]` |
| PR-313 web/admin: pantalla "Hoy" (polling 60s) | PR-310 | `[todo]` |
| PR-314 web/admin: validación de cierres | PR-208 o mocks de PR-106 | `[todo]` |
| PR-315 web/admin: dashboard | PR-209 o mocks de PR-106 | `[todo]` |

## Bloque 6 — Frontend: campo (requiere Bloque 4 ya cerrado)

| Ítem | Depende de | Estado |
|---|---|---|
| PR-316 web/field: ruta del día | Bloque 4, PR-206 o mocks | `[todo]` |
| PR-317 web/field: detalle de stop + navegación | PR-316 | `[todo]` |
| PR-318 web/field: cámara y evidencia (WebP, strip EXIF, cola) | PR-317, PR-207 o mocks | `[todo]` |
| PR-319 web/field: ejecución + cronómetro | PR-317 | `[todo]` |
| PR-320 web/field: insumos con dilución | PR-319 | `[todo]` |
| PR-321 web/field: pago + firma | PR-319 | `[todo]` |
| PR-322 web/field: cierre de jornada y rendición | PR-319 | `[todo]` |

---

## Fuera de alcance de Fase 1 (no tomar todavía)

Insumos/inventario, caja/rendiciones, certificados, contratos recurrentes, reportes,
notificaciones push reales — son Fase 2 (`docs/spec/19-mvp-roadmap.md`). Si terminás
todo lo de arriba antes de que el humano defina Fase 2, avisale en vez de improvisar.
