# Fumibug

Plataforma de Field Service Management para una empresa argentina de control de plagas.
Ver `docs/MASTER_SPEC.md` y `docs/spec/` para la especificación completa.

Este repo lo desarrollan dos agentes que no se comunican entre sí — Claude Code
(backend, datos, plataforma) y OpenCode (frontend). Ver `CLAUDE.md`, `AGENTS.md` y
`docs/adr/`.

> **Estado:** Fase 0 (fundaciones). Sin funcionalidad de negocio todavía.

## Setup

Requisitos: Node 20+ (probado con 24), pnpm 11.5.0 (vía `packageManager` en
`package.json` — usá `corepack enable` para que se resuelva sola), Docker (para
Postgres local).

```bash
corepack enable
pnpm install
docker compose up -d                     # Postgres local — ver docker-compose.yml
cp .env.example .env                     # completar, nunca commitear .env
pnpm db:migrate                          # aplica el schema completo (packages/db)
# setear la password local del rol de runtime (una sola vez, fuera de git):
docker compose exec postgres psql -U fumibug_migrator -d fumibug_dev \
  -c "ALTER ROLE fumibug_app WITH PASSWORD 'lo-que-quieras-en-local';"
pnpm db:seed                             # datos de desarrollo (packages/db/prisma/seed.ts)
pnpm dev                                 # levanta api + web
```

Solo la API:

```bash
pnpm --filter @fumibug/api dev
```

Sin un proyecto Supabase todavía: apuntá `SUPABASE_JWKS_URL`/`SUPABASE_ISSUER` al
server de desarrollo (`apps/api/scripts/dev-auth-server.mjs`) — genera un JWKS local y
emite tokens de prueba con los claims que en producción pone el Auth Hook de Supabase.
Ver el header de ese archivo para el uso completo.

## Comandos

```bash
pnpm dev                    # levanta api + web
pnpm build                  # build de todo el monorepo (turbo)
pnpm lint && pnpm typecheck
pnpm test                   # unit
pnpm test:integration       # con Postgres efímero
pnpm test:tenant-isolation  # bloqueante en CI
pnpm generate               # regenera cliente API + mocks MSW + OpenAPI desde contracts
pnpm db:migrate             # crear/aplicar migración (packages/db)
pnpm db:seed                # datos semilla
pnpm db:studio              # Prisma Studio
```

## Estructura

Monorepo Turborepo + pnpm workspaces. Ver `docs/spec/16-estructura.md` para el detalle
completo y las reglas de dependencia entre paquetes (verificadas por ESLint en
`packages/config/eslint/`).

```
apps/
  api/            ← Claude Code — NestJS
  web/            ← OpenCode — Next.js (esqueleto en Fase 0)
packages/
  db/             ← Claude Code — Prisma (schema.prisma, migraciones, seeds)
  contracts/      ← Claude Code — schemas Zod, contrato único con el frontend
  ui/             ← OpenCode — design system
  config/         ← humano — ESLint, tsconfig, Prettier compartidos
```

## Deploy a producción

`apps/api` → **Railway**, `apps/web` → **Vercel** (docs/spec/15-escalabilidad.md §R.1).
La base sigue siendo **Supabase** en los dos casos — Railway solo corre el backend.

### Railway (`apps/api`)

1. Crear un proyecto nuevo en Railway conectado a este repo.
2. `railway.json` (raíz del repo) ya le dice que buildee con `apps/api/Dockerfile` —
   no hace falta configurar Root Directory a mano.
3. Variables de entorno del proyecto en Railway: todas las de `.env.example` bajo
   `apps/api`, con valores reales — `APP_DATABASE_URL` (rol `fumibug_app` de la base de
   Supabase de producción, password real), `SUPABASE_URL`, `CORS_ALLOWED_ORIGINS`
   (dominio de Vercel), `SENTRY_DSN` si ya existe el proyecto.
4. **Las migraciones NO corren automáticamente al deployar** — es una decisión
   deliberada, no un olvido: correrlas en cada boot es una carrera esperando pasar con
   más de una instancia. Se corren a mano (o desde CI en un paso aparte, más adelante)
   con `DATABASE_URL` de producción:
   ```bash
   DATABASE_URL=<connection string de superusuario de Supabase> pnpm --filter @fumibug/db db:migrate:deploy
   ```
5. Healthcheck: `GET /health` (sin prefijo `/v1`, sin auth) — ya configurado en
   `railway.json`.

### Vercel (`apps/web`)

1. Importar el repo en Vercel. **Root Directory: `apps/web`** (es un monorepo —
   Vercel detecta Next.js + Turborepo y arma el build command solo).
2. Variables de entorno: `NEXT_PUBLIC_API_URL` apuntando a la URL pública de Railway.
3. Una vez conectado, cada PR genera su propio preview deploy automáticamente.

## Propiedad de archivos y convenciones

Ver `CLAUDE.md` (Claude Code) y `AGENTS.md` (OpenCode). No se improvisa arquitectura:
la fuente de verdad es `docs/spec/`, y cualquier desvío se documenta como ADR en
`docs/adr/` antes de implementarse.
