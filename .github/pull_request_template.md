## Qué hace

<!-- Una o dos líneas. Qué problema resuelve, no qué archivos cambió. -->

Closes #

## Sección del spec que implementa

<!-- ej: docs/spec/09-reglas.md §R24, docs/spec/07-uxui.md AD-06 -->

## Checklist

- [ ] Referencia el issue y la sección del spec
- [ ] **No toqué archivos que no son míos** (ver tabla de propiedad en CLAUDE.md / AGENTS.md)
- [ ] Este PR **no cruza la frontera api/web**
- [ ] Las reglas de negocio afectadas tienen test que las nombra por ID (`R14`, `R24`…)
- [ ] Si agrega endpoint: está en `test/tenant-isolation.e2e.ts`
- [ ] Si toca dinero, inventario o estados: hay test de concurrencia
- [ ] Si cambia el contrato: **es un PR aislado**, con changelog
- [ ] Si es pantalla: loading, error y empty resueltos
- [ ] Si es pantalla de campo: probada con modo avión, touch targets ≥56 px, `bundle:check` OK
- [ ] Variables de entorno nuevas en `.env.example`, sin valores reales
- [ ] Sin `any`, sin `console.log`, sin secretos, sin `TODO` sin issue
- [ ] Desvío arquitectónico documentado en un ADR
- [ ] CI en verde

## Notas para el review cruzado

<!-- Qué querés que el otro agente mire con atención. Ej: "la paginación de esta lista,
     ¿te sirve así desde la UI?" / "asumí que este campo siempre viene, ¿confirmás?" -->
