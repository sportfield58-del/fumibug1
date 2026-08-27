# PROMPT — Seguí con el task board (Fase 1)

> Mandale esto a OpenCode tal cual. 2026-08-27.

Los contratos de Fase 1 (Bloque 1 de `prompts/TASK_BOARD.md`) ya están cerrados y
mergeados: usuarios/roles, clientes/ubicaciones, tipos de servicio/zonas/precios,
servicios, planificador/rutas, evidencias/dashboard/auditoría (PR-101 a PR-106, todos
con CI verde en `main`). `pnpm generate` ya corrió — tenés `apps/web/lib/api/client.ts`
y `apps/web/mocks/handlers.ts` actualizados y funcionando.

## Arrancá por acá

1. Leé `prompts/TASK_BOARD.md` entero (protocolo de relevo — claim antes de tocar código,
   marcá `[done]` con el número de PR al terminar).
2. El primer `[todo]` sin dependencias pendientes es **PR-301** (Bloque 3: `web/ui` —
   tokens, tailwind preset, primitivas base). Es el que definís vos: `docs/spec/07-uxui.md`
   tiene los tokens y componentes de referencia.
3. Después de PR-301, pará y mostrale el design system al humano antes de seguir con
   PR-302 — corregir tokens/primitivas después de construir 10 pantallas es carísimo
   (ya está anotado así en `PROMPT_FASE_1_OPENCODE.md`, sigue valiendo).

## Un gap que encontré armando los contratos, para que no te agarre de sorpresa

`PR-106b` (nuevo, agregado al board) — el resto de `/field/*` (ejecución de servicios:
start/pause/resume de sesión, insumos, firma, pago, finish, sync batch offline) todavía
no tiene contrato. Es la Fase 1 de Bloque 6 (pantallas de campo) — para cuando llegues
ahí based on el orden del board (Bloque 4 offline → Bloque 5 admin → Bloque 6 campo), yo
ya debería tener ese contrato listo. Si llegás antes de que esté, avisame en vez de
inventar el shape del endpoint.

## Recordatorio de siempre

- Todos los tipos vienen de `@fumibug/contracts`. Cero excepciones.
- Loading, error y empty en todo componente que consuma datos.
- No toqués `apps/api`, `packages/db` ni `packages/contracts` — si algo que necesitás no
  está en el contrato, marcá el item como bloqueado en el board con una nota, no lo
  inventes del lado del cliente.
