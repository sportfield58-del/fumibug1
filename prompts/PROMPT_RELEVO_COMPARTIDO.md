# PROMPT — Relevo compartido (reemplaza la separación estricta de Fase 1)

> Mandale esto a OpenCode tal cual. Decisión del humano, 2026-08-27.

Cambio de reglas respecto a lo que veníamos haciendo: ya no somos "vos frontend, Claude
Code backend, sin comunicarnos". A partir de ahora los dos trabajamos de **una sola cola
de tareas compartida**: `prompts/TASK_BOARD.md`.

## Qué significa en la práctica

- Ese archivo tiene todos los PRs de Fase 1 — backend y frontend intercalados, con sus
  dependencias.
- Cualquiera de los dos puede tomar el siguiente ítem `[todo]` sin dependencias
  pendientes, sea backend o frontend. No hay más "esto no me toca".
- Antes de tocar código: leé el board entero, elegí un ítem, marcalo
  `[in-progress: opencode · <fecha>]` con un commit chico solo a ese archivo.
- Cuando termines (PR abierta, CI verde): marcalo `[done] → PR #N`.
- Si te quedás sin contexto a mitad de camino: dejalo `[in-progress]` con una línea
  `nota:` de dónde quedaste. La próxima sesión (tuya o de Claude Code) sigue desde ahí,
  no desde cero.
- Seguís trabajando en tu propio worktree (`../fumibug-web`) y tus propias ramas, como
  siempre — eso no cambia. Lo que cambia es que ya no hay frontera de archivos por
  agente, hay frontera por **ítem del board, uno a la vez, marcado**.
- El resto de las reglas de siempre sigue: contrato antes que implementación, tests con
  ID de regla de negocio, test de aislamiento cross-tenant en cada endpoint nuevo,
  CLAUDE.md/AGENTS.md para lo específico de cada área, `docs/spec/**` y los archivos de
  config raíz (`pnpm-workspace.yaml`, `turbo.json`, `packages/config`) siguen siendo del
  humano.

## Por qué

El humano quiere terminar Fase 1 más rápido y no perder tiempo esperando a que a uno de
los dos "le toque" su parte mientras el otro está libre. Prioridad: avanzar el board,
no respetar una frontera de dominio que ya cumplió su propósito en Fase 0.

Arrancá por el primer `[todo]` de `prompts/TASK_BOARD.md` que puedas tomar hoy.
