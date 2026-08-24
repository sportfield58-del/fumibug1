# @fumibug/db

Dueño: Claude Code (ver `CLAUDE.md` §3). Fuente: `docs/spec/08-modelo-datos.md` §H.

## Qué hay acá

- `prisma/schema.prisma` — todas las tablas del modelo de datos, con sus enums, índices
  y relaciones. Lo que Prisma no puede expresar (índices únicos parciales con `WHERE`,
  `UNIQUE ... DEFERRABLE`, `EXCLUDE USING gist`, columnas generadas, triggers, RLS) está
  marcado inline con comentarios `// SQL:` y vive en migraciones raw SQL aparte.
- `prisma/migrations/`:
  - `20260820235959_extensions` — `pgcrypto`, `citext`, `btree_gist`.
  - `20260821000000_init` — generado por Prisma desde el schema (`prisma migrate diff`).
  - `20260821000001_partial_indexes_triggers_rls` — todo lo manual: índices parciales,
    `DEFERRABLE`, exclusion constraint, columnas generadas (`effective_minutes`,
    `difference_cents`), triggers append-only (R42), RLS (§K.4) y el rol `fumibug_app`.
- `src/client.ts` — reexporta `@prisma/client` + el singleton `prisma`. Es lo único que
  `apps/api` debería importar de acá.
- `prisma/seed.ts` — seed de desarrollo idempotente: tenant Fumibug, catálogo de
  permisos (tomado de `@fumibug/contracts`, con autochequeo de cobertura contra la
  matriz rol × permiso), los 6 roles semilla, 1 owner, 1 admin y 2 operarios,
  depósito central con 5 insumos/lotes/stock, tipos de servicio, lista de precios
  y 10 clientes con contacto y ubicación. IDs deterministas: se puede correr N veces.

## Seed

```bash
pnpm --filter @fumibug/db db:seed     # o prisma migrate dev --skip-seed para no correrla
```

- Corre con el rol migrador (`DATABASE_URL`), dentro de una transacción con
  `SET LOCAL app.tenant_id` — las tablas tienen `FORCE ROW LEVEL SECURITY`.
- Los vencimientos (libretas, lotes) son relativos a la fecha de ejecución, así las
  alertas de demo siguen vivas siempre.
- Usuarios de dev: `carlos@fumibug.dev` (owner) · `lucia@fumibug.dev` (admin) ·
  `diego@fumibug.dev` y `marina@fumibug.dev` (operarios). Cuando exista Supabase Auth,
  crear ahí usuarios con estos mismos UUIDs.
- Casos de prueba incluidos: libreta de operario por vencer (~25 días, alerta R15),
  lote próximo a vencer y un insumo bajo stock mínimo.

## Dos roles de Postgres, nunca el mismo

- **Migrador** (`DATABASE_URL`): el que corre `prisma migrate deploy`. Necesita crear
  tablas, roles, extensiones — en Supabase, el rol `postgres`. **Nunca** es el que usa la
  API en runtime.
- **`fumibug_app`** (`APP_DATABASE_URL`): sin `BYPASSRLS`, sin superusuario, creado por la
  migración `..._partial_indexes_triggers_rls`. Es el que usa `apps/api` (PR 5). Su
  contraseña **no está en ningún archivo del repo** — se setea una sola vez con
  `ALTER ROLE fumibug_app WITH PASSWORD '...'` y se guarda como secreto en
  Railway/GitHub Secrets, nunca en `.env.example` (CLAUDE.md §5).

## Setup local

```bash
cp .env.example ../../.env   # o packages/db/.env con las mismas claves
pnpm --filter @fumibug/db prisma:generate
pnpm --filter @fumibug/db db:migrate       # dev: crea/aplica migraciones
pnpm --filter @fumibug/db db:migrate:deploy # CI/prod: aplica sin generar nuevas
```

## Por qué `id UUID` en `inventory` en vez de la PK compuesta que pide el spec

`docs/spec/08-modelo-datos.md` pide `PRIMARY KEY (stock_location_id, supply_id, lot_id)`.
Prisma no acepta una `@@id`/`@@unique` como única criteria de un modelo si algún campo es
nullable (`lot_id` lo es — hay stock sin trazabilidad de lote). Se agregó un `id` UUID
surrogate y se preservó la unicidad real de negocio con
`@@unique([stockLocationId, supplyId, lotId])` — Postgres no colisiona `NULL`s en un
`UNIQUE`, que es exactamente la semántica que pedía la PK compuesta original. Ver
comentario en el modelo `Inventory` del schema.

## Validado contra Postgres real

El schema completo (37 tablas, RLS, triggers, `DEFERRABLE`, exclusion constraint,
columnas generadas) se corrió contra una instancia Postgres real antes de este PR —
incluyendo pruebas de comportamiento (aislamiento por tenant con dos conexiones
distintas, bloqueo de `UPDATE` en tablas append-only con y sin el trigger). El test
automatizado que corre en cada PR contra el Postgres efímero de CI está en
`test/migration.integration.spec.ts`.
