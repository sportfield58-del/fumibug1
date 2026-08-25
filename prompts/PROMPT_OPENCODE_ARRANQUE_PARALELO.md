# PROMPT — OpenCode, arranque en paralelo con Fase 0 todavía abierta

> Pegar esto en la sesión de OpenCode.

Sos el agente de frontend de Fumibug. Leé `AGENTS.md` antes de nada si no lo hiciste ya
en esta sesión.

## Dónde trabajar — importante

**No uses la carpeta principal del repo.** Claude Code sigue trabajando ahí en paralelo
(Fase 0, PRs 9 y 10 — test de aislamiento cross-tenant y deploys) y si los dos
escribimos en el mismo working directory nos pisamos los archivos sin que git se
entere — ya pasó una vez.

Tu carpeta es un `git worktree` separado, ya creado:

```
C:\Users\fede\Documents\fumibug-web
```

Es el mismo repo (comparte historial y remoto), pero un working directory propio. Metete
ahí y arrancá tus ramas desde la branch `integration/fase0-latest` (ya actualizada hasta
PR 8):

```bash
cd C:\Users\fede\Documents\fumibug-web
git checkout -b feat/web/<slug> integration/fase0-latest
pnpm install
pnpm --filter @fumibug/web dev
```

Esa branch ya tiene, además del monorepo completo:

- `apps/web/lib/api/client.ts` — **cliente HTTP tipado, generado** (`getAuthMe()`,
  `getPing()`, más el que agreguemos a medida que salgan contratos de Fase 1).
  No se edita a mano — se regenera con `pnpm generate` desde la raíz cuando cambia
  `packages/contracts`.
- `apps/web/mocks/{handlers,browser,server}.ts` — MSW con datos realistas (el
  `example` de cada endpoint). `browser.ts`/`server.ts` sí son tuyos para ajustar,
  `handlers.ts` es generado.
- `apps/web/src/app/page.tsx` — hoy solo llama `GET /v1/ping` y muestra la respuesta
  (es la prueba de fin de Fase 0, no una pantalla real). La reemplazás sin problema.
- `packages/contracts` con: todos los enums del sistema, catálogo de `ErrorCode`,
  `ApiSuccess<T>`/`ApiError`/`Paginated<T>`, schemas de auth/tenant/user/membership, y
  el registro de endpoints (`ENDPOINTS`) que alimenta el generador. Todavía sin
  schemas de módulos de negocio — eso es Fase 1, un PR de contrato a la vez.

## Por qué arrancamos antes de que Fase 0 esté mergeada

`BOOTSTRAP.md` dice que esperes a que Fase 0 esté mergeada con CI en verde. Seguimos esa
regla en espíritu: los PRs 1 a 8 de Claude Code ya tienen CI en verde, están abiertos y
van a mergearse en orden. Quedan PR 9 (test de aislamiento cross-tenant) y PR 10
(deploys) — ninguno te bloquea para lo que te toca ahora.

Cuando el humano mergee esos PRs a `develop`, hacé, en tu worktree (no en el principal):
```bash
git fetch origin && git rebase origin/develop
```

## Qué SÍ podés construir ya

1. **`packages/ui`** — design system base: `tokens.css` (paleta y tipografía de
   `docs/spec/07-uxui.md`), componentes primitivos (Button, Input, Card, Badge de
   estado), `tailwind-preset.ts`.
2. **App shell y routing** — los dos route groups de ADR 0008: `(admin)` desktop y
   `(campo)` PWA, según `docs/spec/16-estructura.md` §U. Sin datos reales todavía.
3. **`(auth)/login`** — tipá el form con `LoginRequestSchema`/`LoginResponseSchema` de
   `@fumibug/contracts` (ya existen). El cliente real todavía no tiene esos endpoints
   (Supabase Auth los emite directo — ADR 0003); mockealo con MSW mientras tanto.
4. **Motor offline** (ADR 0006) — Dexie + outbox + sync engine, según
   `docs/spec/12-offline-pwa.md`. No depende de ningún endpoint de negocio específico.
5. **Reemplazar `page.tsx`** por el layout real que corresponda, moviendo el ping de
   prueba a donde tenga sentido (o borrándolo) una vez que haya login de verdad.
6. Tests de componente de todo lo anterior.

## Qué NO hacer todavía

- No construyas pantallas que necesiten un endpoint de negocio real (clientes,
  servicios, rutas, inventario, caja, certificados) — esos contratos llegan en Fase 1,
  uno por uno.
- No toques `apps/api/**` ni `packages/db/**`.
- No definas un tipo que debería salir de `@fumibug/contracts`, ni edites
  `apps/web/lib/api/**` a mano — son generados. Si te falta un campo, es un
  `contract-change`, avisale al humano.
- No mergees nada vos. Abrí tu PR contra `develop` cuando quieras; el review y el merge
  los hace el humano.

## Contexto que te puede servir

- `docs/spec/07-uxui.md` — pantallas, tokens, componentes
- `docs/spec/12-offline-pwa.md` — el motor offline en detalle
- `docs/spec/16-estructura.md` §U — estructura exacta de carpetas
- `docs/api/openapi.json` — generado, referencia rápida de lo que existe hoy
- ADR 0005 (contratos), ADR 0006 (offline asimétrico), ADR 0008 (una app, dos route groups)

Cualquier duda de contrato o de secuencia, preguntale al humano antes de asumir.
