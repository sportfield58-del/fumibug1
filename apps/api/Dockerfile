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
# para imágenes de Docker de un workspace. --legacy: desde pnpm v10, deploy por default
# exige "inject-workspace-packages=true" (copia real de las deps de workspace en vez de
# symlinks); no tocamos pnpm-workspace.yaml (fuera de los archivos de apps/api), así que
# usamos el modo anterior explícito, que sigue soportado y resuelve igual.
# --ignore-scripts: pnpm deploy hace su propio install "limpio" en /prod/api, y ahí el
# postinstall de @fumibug/db ("prisma generate") intenta autorepararse con
# `npm i @prisma/client` si no encuentra la versión exacta ya resuelta — y ese install
# falla en el sandbox de build de Railway (sin red/permiso para eso). No hace falta que
# corra ahí: generamos el cliente a mano en el paso siguiente, con la CLI completa de
# /repo (que sí tiene @prisma/client bien instalado desde el `pnpm install` de la etapa
# deps) apuntando al schema que viaja dentro de /prod/api.
RUN pnpm --filter @fumibug/api deploy --prod --legacy --ignore-scripts /prod/api
# Binario directo, no "pnpm exec"/"pnpm --filter ... exec": esos comandos revisan antes
# si /repo/node_modules está "al día" y, con CI=true (necesario para no abortar sin TTY),
# terminan re-ejecutando `pnpm install --production` — que borra las devDependencies
# (prisma incluido) antes de que el propio comando llegue a correr. `prisma` es
# devDependency de packages/db: pnpm crea su symlink de bin ahí, no en /repo/node_modules.
RUN packages/db/node_modules/.bin/prisma generate --schema=/prod/api/node_modules/@fumibug/db/prisma/schema.prisma

# --- runtime: imagen final, solo lo que hace falta para correr ---
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
