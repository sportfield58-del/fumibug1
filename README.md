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
cp .env.example .env    # completar con valores reales, nunca commitear .env
pnpm dev                # levanta api + web
```

Solo la API:

```bash
pnpm --filter @fumibug/api dev
```

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

## Propiedad de archivos y convenciones

Ver `CLAUDE.md` (Claude Code) y `AGENTS.md` (OpenCode). No se improvisa arquitectura:
la fuente de verdad es `docs/spec/`, y cualquier desvío se documenta como ADR en
`docs/adr/` antes de implementarse.
