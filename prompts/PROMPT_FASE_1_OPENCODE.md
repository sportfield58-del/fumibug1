# PROMPT — Arranque de OpenCode (Fase 1)

> **Cuándo:** después de que la Fase 0 esté mergeada en `develop` con CI en verde.
> **Dónde:** en OpenCode, sobre un `git worktree` propio.

---

Sos el agente de frontend de Fumibug. Leé `AGENTS.md` antes de nada.

La Fase 0 ya está: el monorepo, el schema, los contratos y la plataforma del backend
existen y funcionan. Vos empezás la **Fase 1** en paralelo con Claude Code, que va a estar
implementando los endpoints de negocio mientras vos construís las pantallas.

## Leé primero

1. `AGENTS.md` — tus reglas, tus archivos, lo que no tocás
2. `docs/spec/07-uxui.md` — tokens, pantallas y componentes
3. `docs/spec/12-offline-pwa.md` — el motor offline
4. `packages/contracts/src/index.ts` — de acá salen **todos** tus tipos

No leas `MASTER_SPEC.md` entero.

## Cómo no quedar bloqueado

Claude Code publica el contrato de cada módulo **antes** de implementarlo. Corré
`pnpm generate` y vas a tener el cliente tipado y los mocks de MSW listos. Desarrollás
contra `pnpm dev:mock` sin esperar a nadie.

Si necesitás un campo que no está en el contrato: **no lo inventes**. Abrí un issue con
label `contract-change` y `agent:claude-code`, y seguí con otra tarea.

## Orden de construcción (no lo alteres)

### Bloque 1 — Fundaciones visuales
```
PR 1   feat(ui): tokens, tailwind preset, primitivas base
       (button, input, select, combobox, dialog, sheet, toast, badge,
        skeleton, empty-state, error-boundary)
PR 2   feat(web): shell de admin (sidebar, topbar, breadcrumbs, layout)
       + shell de campo (header sticky, botón fijo inferior, safe areas)
PR 3   feat(web): login admin + login operario (usuario + PIN numérico)
       + guardas de ruta por permiso
```

### Bloque 2 — Motor offline (antes que las pantallas de campo)
```
PR 4   feat(web/offline): Dexie schema, outbox, SyncEngine con orden causal,
       backoff exponencial, idempotencia por clientEventId
PR 5   feat(web/offline): service worker con Workbox, scopeado a /campo,
       manifest, precache del bundle de /field/today
PR 6   feat(web/offline): pantalla de estado de sincronización + indicador global
       + tests de: modo avión, reintento, duplicados, app cerrada a mitad
```

**Este bloque va antes que las pantallas.** Construir las pantallas primero y "agregarle
offline después" es la forma conocida de que no funcione nunca.

### Bloque 3 — Admin
```
PR 7   feat(web/admin): clientes (lista + detalle + alta)
PR 8   feat(web/admin): ubicaciones
PR 9   feat(web/admin): alta rápida de servicio  ← la pantalla más usada del sistema
PR 10  feat(web/admin): lista de servicios con filtros
PR 11  feat(web/admin): planificador con drag & drop (@dnd-kit)
PR 12  feat(web/admin): detalle de ruta + publicación
PR 13  feat(web/admin): pantalla "Hoy" (monitoreo con polling 60s)
PR 14  feat(web/admin): validación de cierres
PR 15  feat(web/admin): dashboard
```

### Bloque 4 — Campo
```
PR 16  feat(web/field): ruta del día
PR 17  feat(web/field): detalle del stop + navegación
PR 18  feat(web/field): cámara y evidencia (compresión WebP, strip EXIF, cola)
PR 19  feat(web/field): pantalla de ejecución + cronómetro
PR 20  feat(web/field): insumos con dilución
PR 21  feat(web/field): pago + firma
PR 22  feat(web/field): cierre de jornada y rendición
```

## Antes de empezar

Pará después del PR 1 y mostrame el design system. Los tokens y las primitivas definen
cómo se ve todo lo demás; corregirlos en el PR 15 es carísimo.

## Recordá

- Todos los tipos vienen de `@fumibug/contracts`. Cero excepciones
- Loading, error y empty en todo componente que consuma datos
- En `/campo`: touch targets ≥56 px, contraste ≥7:1, bundle <200 KB gz
- Nada de `localStorage` para datos de negocio — Dexie
- Probá cada pantalla de campo con el modo avión activado antes de pedir review
- No toques `apps/api`, `packages/db` ni `packages/contracts`
