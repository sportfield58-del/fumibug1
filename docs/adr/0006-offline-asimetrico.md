# ADR 0006 — Offline asimétrico con outbox e idempotencia

**Estado:** Aceptado · 2026-08-21

## Contexto
Los operarios trabajan en sótanos, depósitos y zonas sin cobertura. Si la app no funciona
sin señal, vuelven al cuaderno y el proyecto fracasa. Pero offline-first completo con
sincronización bidireccional es un proyecto en sí mismo.

## Decisión
**Offline asimétrico**: lectura cacheada + escritura encolada, solo en `/campo`.

- El bundle del día (`/field/today`) se precachea al publicarse la ruta.
- Toda acción se escribe primero en IndexedDB y se encola en un outbox.
- El SyncEngine procesa en orden causal, con backoff exponencial.
- Cada evento lleva `clientEventId` (UUID v4 del cliente); el servidor deduplica.
- Conflictos: el servidor gana en catálogos, el dispositivo gana en hechos ocurridos.
  Si hay contradicción (servicio cancelado mientras el operario trabajaba), se **acepta**
  el registro y se marca `conflict_flag` para que un humano decida.

## Alternativas consideradas
- **Sin offline:** inaceptable, mata el producto.
- **Offline-first completo (Replicache, CRDTs):** complejidad desproporcionada.
- **Offline también en admin:** complejidad alta, valor nulo.

## Consecuencias
- La idempotencia por `clientEventId` con constraint única en DB es obligatoria desde el
  primer commit: sin ella, un backoff genera pagos duplicados.
- El motor de sincronización se construye **antes** que las pantallas de campo.
- Se guardan dos tiempos: `occurred_at` (dispositivo) y `recorded_at` (servidor).
