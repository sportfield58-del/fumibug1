# Build de apps/api para Railway. Contexto de build = RAÍZ del repo (no apps/api):
# es un workspace pnpm, apps/api depende de packages/db y packages/contracts vía
# "workspace:*", así que el build necesita ver el monorepo completo. railway.json
# apunta acá con dockerfilePath="apps/api/Dockerfile" y Railway usa la raíz del repo
# como contexto por default.
#
# docs/spec/15-escalabilidad.md §R.1: Railway corre el monolito NestJS. La base sigue
# siendo Supabase — este Dockerfile no incluye Postgres ni corre migraciones (eso es
# un paso deliberado y separado, ver README.md "Deploy a producción").

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /repo

# --- deps: solo los package.json de cada paquete del workspace. Hace falta el de
# TODOS (incluidos apps/web y packages/ui) para que pnpm resuelva el lockfile igual
# que en desarrollo, aunque después no se compile su código. ---
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
# El postinstall de packages/db ("prisma generate") corre en este mismo `pnpm install`
# de más abajo — necesita prisma/schema.prisma presente, no solo el package.json.
COPY packages/db/prisma packages/db/prisma
COPY packages/contracts/package.json packages/contracts/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# --- build: código fuente de lo que sí hace falta compilar (apps/api y sus deps de
# workspace), vía turbo con --filter para no tocar apps/web/packages/ui. ---
FROM deps AS build
COPY packages/config packages/config
COPY packages/db packages/db
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm exec turbo run build --filter=@fumibug/api...
# pnpm deploy: empaqueta apps/api + sus deps de producción resueltas (sin dev deps, sin
# el resto del monorepo) en un directorio autocontenido — el patrón recomendado de pnpm
# para imágenes de Docker de un workspace.
RUN pnpm --filter @fumibug/api deploy --prod /prod/api

# --- runtime: imagen final, solo lo que hace falta para correr ---
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
