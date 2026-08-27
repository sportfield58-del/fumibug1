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
# `pnpm deploy` (el patrón "recomendado" para imágenes lean de un workspace pnpm) resultó
# poco confiable acá: arma un node_modules aislado desde cero en un directorio nuevo, y en
# ese contexto Prisma nunca logró resolver bien @prisma/client — ni con --ignore-scripts,
# ni generando después a mano por distintos caminos (ver el historial de fix/api/0011 a
# 0024, todos intentos reales contra Railway). En vez de reinstalar en otro lado, se copia
# el workspace tal cual quedó de la etapa `deps` (el install que sí funciona siempre, es el
# mismo camino que usa CI) — sin ningún comando de pnpm más que pueda tocar node_modules de
# formas inesperadas. Más pesado que un deploy aislado (sin podar devDependencies), pero
# determinista; se optimiza el tamaño más adelante, una vez que el deploy sea confiable.

# --- runtime: imagen final. No hace falta pnpm acá (solo "node dist/main.js"). ---
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
