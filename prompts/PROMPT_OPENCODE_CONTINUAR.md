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
2. **A partir de ahora, Bloque 2 (implementación de la API sobre los contratos de Fase 1
   — usuarios, clientes, tipos de servicio, servicios, planificador/rutas) también es
   tuyo si querés tomarlo.** Es backend (`apps/api`), pero el relevo compartido ya no
   separa por dominio — el humano decidió explícitamente dejarte ese bloque a vos. Los
   10 items (PR-201 a PR-210) están `[todo]`, la mayoría sin dependencias pendientes
   (los contratos que necesitan ya están mergeados).
3. Si preferís frontend, el primer `[todo]` de ese lado es **PR-301** (Bloque 3: `web/ui`
   — tokens, tailwind preset, primitivas base). `docs/spec/07-uxui.md` tiene los tokens y
   componentes de referencia. Después de PR-301, pará y mostrale el design system al
   humano antes de seguir con PR-302 — corregir tokens/primitivas después de construir 10
   pantallas es carísimo (ya está anotado así en `PROMPT_FASE_1_OPENCODE.md`, sigue
   valiendo).
4. Elegí vos cuál de los dos bloques te resulta más natural seguir — no hay orden
   obligatorio entre Bloque 2 y Bloque 3, solo dependencias dentro de cada uno.

## Un gap que encontré armando los contratos, para que no te agarre de sorpresa

`PR-106b` (nuevo, agregado al board) — el resto de `/field/*` (ejecución de servicios:
start/pause/resume de sesión, insumos, firma, pago, finish, sync batch offline) todavía
no tiene contrato. Es la Fase 1 de Bloque 6 (pantallas de campo) — para cuando llegues
ahí based on el orden del board (Bloque 4 offline → Bloque 5 admin → Bloque 6 campo), yo
ya debería tener ese contrato listo. Si llegás antes de que esté, avisame en vez de
inventar el shape del endpoint.

## Recordatorio de siempre

- Todos los tipos del lado del cliente vienen de `@fumibug/contracts`. Cero excepciones.
- Loading, error y empty en todo componente que consuma datos.
- `packages/contracts` sigue siendo solo mío (Claude Code) — el contrato se publica y
  mergea antes que su implementación (ADR 0005 regla dura #1). Si un ítem de Bloque 2
  necesita un campo que no está en el contrato, avisá en vez de inventarlo.
- Si tomás un ítem de Bloque 2 (`apps/api`): seguís CLAUDE.md §4/§5 igual que yo — RLS,
  `StateMachineService` para transiciones de estado, tests con ID de regla de negocio,
  todo endpoint nuevo al test de aislamiento cross-tenant. No es "menos estricto" por ser
  vos quien lo escribe.
- `docs/spec/**`, `pnpm-workspace.yaml`, `turbo.json`, `packages/config/**` siguen siendo
  del humano, para cualquiera de los dos.
