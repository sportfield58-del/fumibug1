# PROMPT — FASE 0 · Claude Code (en solitario)

> **Cuándo:** primer prompt del proyecto. OpenCode **no arranca** hasta que esta fase esté
> mergeada con CI en verde.
> **Dónde:** en Claude Code, con el repo vacío (solo `docs/` y los `.md` de bootstrap).

---

Sos el agente de backend, datos y plataforma de Fumibug. Leé `CLAUDE.md` antes de nada.

Vamos a hacer la **Fase 0: fundaciones**. Trabajás solo. No se implementa nada de negocio
todavía: se construye el esqueleto sobre el que después dos agentes trabajan en paralelo
sin pisarse. Si la Fase 0 sale mal, todo lo demás sale mal.

## Leé primero

1. `CLAUDE.md` — tus reglas, tus archivos, los invariantes
2. `docs/spec/00-overview.md` — qué es el producto
3. `docs/spec/08-modelo-datos.md` — el modelo completo
4. `docs/spec/11-seguridad.md` — auth y las tres capas de aislamiento multi-tenant
5. `docs/adr/` — las 8 decisiones ya tomadas

No leas `MASTER_SPEC.md` entero. Es muy grande y no lo necesitás para esta fase.

## Qué construir

### 1. Monorepo
Turborepo + pnpm workspaces con la estructura exacta de `docs/spec/16-estructura.md`.
`apps/api`, `apps/web` (esqueleto vacío, lo llena OpenCode), `packages/{db,contracts,ui,config}`.
TypeScript strict. ESLint con la regla de dependencias entre paquetes: `apps/web` no puede
importar de `apps/api` ni de `packages/db`.

### 2. `packages/db`
- `schema.prisma` con **todas** las tablas de `docs/spec/08-modelo-datos.md`
- Todos los índices, constraints y ENUMs especificados
- Los índices únicos parciales (una sesión abierta por operario, una ruta por operario por
  día, un stop activo por servicio, una rendición abierta por caja): son la defensa
  principal contra los problemas de concurrencia
- `UNIQUE(route_id, sequence) DEFERRABLE INITIALLY DEFERRED` — sin `DEFERRABLE` no se
  pueden reordenar stops en una transacción
- Migración inicial
- Triggers que rechazan `UPDATE`/`DELETE` en `audit_logs`, `cash_movements` e
  `inventory_movements`
- Policies de RLS en todas las tablas multi-tenant, usando `current_setting('app.tenant_id')`
- `seed.ts`: tenant Fumibug, 6 roles semilla, catálogo completo de permisos, 1 owner,
  1 admin, 2 operarios, 10 clientes con ubicaciones, 5 insumos con lotes, 1 lista de precios

### 3. `packages/contracts`
- Todos los ENUMs del sistema (estados de service, route, stop, session, closure,
  certificate; métodos de pago; tipos de movimiento de inventario y caja)
- El catálogo completo de `ErrorCode` como enum estable
- Tipos de respuesta estándar: `ApiSuccess<T>`, `ApiError`, `Paginated<T>`
- Schemas Zod de auth y entidades base (user, tenant, membership)
- **Nada más.** Los schemas de cada módulo se agregan en su propio PR durante la Fase 1

### 4. `apps/api` — plataforma, sin negocio
- NestJS con módulo `common` completo
- **Auth**: verificación de JWT de Supabase por JWKS cacheado, `JwtGuard`
- **Tenant context**: `AsyncLocalStorage` con `tenantId`, cargado por `TenantGuard` desde
  el claim del token — nunca desde header ni body
- **Extensión de Prisma** que inyecta `tenantId` en toda query de modelos multi-tenant y
  lanza excepción si no hay tenant en contexto
- **RLS**: la conexión usa un rol de Postgres **sin `BYPASSRLS`**; cada request abre
  transacción y ejecuta `SET LOCAL app.tenant_id`
- `PermissionGuard` + decorador `@RequirePermission('recurso.accion')`, con scope
  `own`/`team`/`tenant`
- **Interceptor de auditoría**: registra toda mutación con actor, before, after, diff, IP,
  requestId y severidad, **en la misma transacción que la mutación**
- Exception filter global con el formato de `docs/spec/10-api.md`
- `ValidationPipe` global con Zod, `whitelist: true`, `forbidNonWhitelisted: true`
- Rate limiting con los límites de `docs/spec/11-seguridad.md`
- `StateMachineService` genérico con `SELECT ... FOR UPDATE` y tabla de transiciones permitidas
- Logger estructurado JSON + Sentry
- Helmet, CORS con allowlist, health check
- **Un endpoint dummy** `GET /v1/ping`: autenticado, con tenant, con permiso y auditado,
  que devuelve el usuario y sus permisos efectivos

### 5. Generadores
Scripts que a partir de `packages/contracts` producen:
- `apps/web/lib/api/**` — cliente tipado, con header "GENERADO, no editar"
- `apps/web/mocks/**` — handlers de MSW con datos realistas
- `docs/api/openapi.json`

Comando: `pnpm generate`. **Este es el mecanismo que permite que OpenCode no quede bloqueado.**

### 6. CI
En cada PR, bloqueante: `lint` · `typecheck` · `test:unit` · `test:integration` (Postgres
efímero, migraciones desde cero) · `test:tenant-isolation` · `build` · `bundle-budget` ·
`migration-check`.
Merge a `develop`: deploy a staging + e2e. Merge a `main`: backup, migración, deploy, smoke.

### 7. Test de aislamiento cross-tenant
`apps/api/test/tenant-isolation.e2e.ts`: crea dos tenants con datos, se autentica como
usuario del tenant A y recorre todos los endpoints intentando acceder a IDs del tenant B.
`404` en el 100% de los casos. Hoy tiene un solo endpoint; el diseño tiene que hacer
trivial agregar cada endpoint nuevo. **Bloqueante para siempre.**

### 8. Infra
`.env.example` con todas las claves y ningún valor real. `docker-compose.yml` para Postgres
local. README con setup completo. Deploy de `apps/api` a Railway y `apps/web` a Vercel,
vacíos pero funcionando.

## Cómo trabajar

PRs chicos y secuenciales, no uno gigante:

```
PR 1   chore: monorepo, tooling, CI base
PR 2   feat(contracts): enums, error codes, tipos de respuesta
PR 3   feat(db): schema completo, migraciones, triggers, RLS
PR 4   feat(db): seeds
PR 5   feat(api): auth + JWT + tenant context + extensión de Prisma
PR 6   feat(api): permisos, guards, decoradores
PR 7   feat(api): auditoría, errores, validación, rate limit, state machine
PR 8   chore: generadores de cliente API y mocks MSW
PR 9   test: aislamiento cross-tenant + CI completo
PR 10  chore: deploys y documentación de setup
```

Después de cada PR pará y mostrame el diff antes de mergear.

## Criterio de salida

Un endpoint dummy autenticado, con tenant, con permiso verificado y auditado, consumido
desde el frontend deployado, con todos los tests en verde en CI. **Cero funcionalidad de
negocio.**

Cuando esté, avisame: recién ahí entra OpenCode.

## Recordá

- No toques `apps/web/src/**` más allá del esqueleto mínimo y los archivos generados
- Si algo del spec te parece mal, escribí un ADR y proponelo — no lo cambies por tu cuenta
- Si algo del spec es ambiguo, preguntame antes de decidir
