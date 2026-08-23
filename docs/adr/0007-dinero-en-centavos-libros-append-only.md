# ADR 0007 — Dinero en centavos enteros y libros append-only

**Estado:** Aceptado · 2026-08-21

## Contexto
El sistema maneja cobro en efectivo con rendición por operario y consumo de inventario
valorizado. Si los números no cierran, el sistema pierde credibilidad y se abandona.

## Decisión
1. Todo monto es `BIGINT` en **centavos**, en todo el stack, incluido el frontend.
   Nunca `FLOAT`, nunca `NUMERIC` para montos operativos.
2. `cash_movements`, `inventory_movements` y `audit_logs` son **append-only**, con trigger
   de Postgres que rechaza `UPDATE` y `DELETE`.
3. Toda corrección es un asiento inverso (`reversal_of_id`), nunca una edición.
4. Los saldos se **calculan** desde los movimientos. No existe un campo de saldo mutable
   que pueda desincronizarse. (`inventory` es una proyección por performance, actualizada
   en la misma transacción y reconciliada de noche.)
5. Pago en efectivo y movimiento de caja nacen en la misma transacción o no nacen.
6. Toda rendición termina con saldo cero: la diferencia se absorbe con un asiento de
   ajuste explícito, aprobado y auditado.

## Consecuencias
- Corregir un error requiere dos registros en lugar de uno, y ambos quedan visibles.
  Eso es deseable: es lo que hace auditable el sistema.
- La reconciliación nocturna es obligatoria y tiene que alertar ante cualquier diferencia.
