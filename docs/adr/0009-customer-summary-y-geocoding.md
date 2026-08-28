# ADR 0009 — Semántica de `customer summary` y `geocoding` de ubicaciones

**Estado:** Aceptado · 2026-08-27

## Contexto

Al implementar PR-202 (clientes + contactos + ubicaciones) el spec en prosa
(`docs/spec/03-modulos.md §C.3/§C.4`, `10-api.md §J.2`) define los campos y endpoints,
pero **no** fija dos semánticas finas:

1. La fórmula de `GET /customers/:id/summary` (`accountBalanceCents`,
   `upcomingServicesCount`, `lastServiceAt`). El contrato solo dice
   "negativo = el cliente debe" (`packages/contracts/src/schemas/customer.ts`).
2. Las transiciones de `geocodeStatus` del endpoint `POST /locations/:id/geocode`.
   El spec (`12-offline-pwa.md §M.2`) solo dice "Google Geocoding al crear, resultado
   persistido, corrección manual arrastrando un pin, nunca geocodificar repetido (costo)".

Como el spec calla en estos dos puntos (ADR 0005: el contrato manda, y donde no hay
contrato no se improvisa en silencio), se fijan acá las decisiones de PR-202.

## Decisión — Summary

- `accountBalanceCents = Σ(payments.status = CONFIRMED, amountCents) − Σ(services facturables)`.
  No hay un modelo de "facturación" en el MVP (Fase 4 de ARCA llega después), así que la
  "cuenta corriente" en Fase 1 se computa como *cobrado* contra *facturado (server priceCents)*:
  - facturado = `services` del cliente con `status` final/cerrado (`COMPLETED`), precio
    `priceCents`; se excluyen `isWarrantyVisit` (precio 0, R7).
  - cobrado = `payments` del cliente con `status = CONFIRMED`; se excluyen `VOIDED` (R26:
    un pago no se edita, se anula).
  - Resultado **negativo = el cliente debe** (coincide con el contrato).
- `upcomingServicesCount` = cantidad de `services` futuros del cliente (`status = SCHEDULED`
  y `scheduledDate >= hoy`), no archivados — los candidatos a programar.
- `lastServiceAt` = `scheduledDate` del servicio `COMPLETED` más reciente del cliente, o
  `null` si no tiene ninguno.

Hasta que existan los servicios/pagos reales (PR-204, PR-207), las queries devuelven 0/null
con datos vacíos — mismas queries reales que el dashboard (ningún hardcode).

## Decisión — Geocoding

`POST /locations/:id/geocode` (y el alta de ubicación):

- Si el request trae `manualLat`/`manualLng`: se graban esos valores y `geocodeStatus = MANUAL`
  (es la corrección manual del pin del admin). El proveedor NO se consulta.
- Si no viene manual: se consulta el proveedor de geocoding. Éxito → `geocodeStatus = OK`
  con `lat`/`lng` reales; fallo o proveedor no configurado → `geocodeStatus = FAILED`
  (nunca queda `PENDING` tras un intento).
- El proveedor es un puerto inyectable (`GeocodingProvider`) con una implementación por
  defecto que, sin credenciales configuradas, **no** hace llamadas de red (devuelve
  `FAILED`/sin coordenadas) — coherente con que Fumibug en Fase 1 no tiene clave de
  Google Geocoding en los entornos de dev/mock. Documenta el contrato del puerto; la
  implementación real (Google) es un PR aparte con su credencial, sin cambiar la firma.

## Consecuencias

- El frontend (PR-307) consume `accountBalanceCents` y `geocodeStatus === 'OK'` con mocks;
  estas reglas lo hacen compatible con datos reales sin cambiar la forma de la respuesta.
- Si en Fase 2 cambia el modelo de facturación, este ADR se actualiza; la firma del
  contrato queda estable.
- Google Geocoding real se activa configurando el provider con credencial — no altera el
  contrato ni los controllers.
