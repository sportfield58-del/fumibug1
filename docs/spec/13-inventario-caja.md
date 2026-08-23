<!-- Extraído de docs/MASTER_SPEC.md · secciones §N, §O, §P -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## N. INVENTARIO

### N.1 El problema que tu planteo no resuelve

Un inventario de un solo depósito no sirve acá, por tres razones:

1. **El consumo ocurre en el vehículo.** El operario carga el lunes 5 litros de Cipermetrina en la camioneta y consume de ahí toda la semana. Si el sistema descuenta del depósito al momento del servicio, el depósito muestra stock que físicamente no está.
2. **Se compra concentrado, se aplica diluido.** El operario dice "usé 8 litros de mezcla". Eso no es 8 litros de producto: con dilución de 20 ml/L son 160 ml de concentrado. Si el operario carga "8" y el sistema descuenta 8 litros, el stock se va a cero en dos días.
3. **El lote es obligatorio.** El certificado sanitario debe indicar el lote aplicado. Sin trazabilidad de lote, el certificado es incompleto.

### N.2 Modelo

```
COMPRA ──► depósito central (lote + vencimiento + costo)
   │
   └─► TRANSFERENCIA ──► stock del vehículo/operario   [2 movimientos espejo]
                              │
                              ├─► CONSUMO en servicio  [mezcla → concentrado vía dilution_rate]
                              ├─► DEVOLUCIÓN al depósito
                              ├─► PÉRDIDA (derrame, rotura)
                              └─► BAJA POR VENCIMIENTO
```

Tipos de movimiento: `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `CONSUMPTION`, `RETURN`, `ADJUSTMENT`, `LOSS`, `EXPIRY_WRITE_OFF`.

**La verdad son los movimientos.** La tabla `inventory` es una proyección por performance, actualizada en la misma transacción y reconciliada de noche.

### N.3 Flujo de carga de vehículo

Pantalla "Cargar camioneta": el admin selecciona operario, elige productos y cantidades (con sugerencia calculada a partir de los servicios de la ruta del día). Genera transferencias. El operario ve el stock actualizado en su app.

### N.4 Consumo con dilución

El operario elige entre dos modos, según el producto:

- **Modo mezcla** (spray): ingresa litros de mezcla aplicada. El sistema calcula `concentrate = litros_mezcla × dilution_rate_ml_per_l / 1000` y descuenta eso. Guarda ambos valores.
- **Modo directo** (gel, cebo, polvo): ingresa gramos/unidades. Descuento 1:1.

Ambos valores viajan al certificado: "aplicación de X en dilución 20 ml/L, 8 L de solución preparada".

### N.5 Stock negativo

Regla asimétrica y deliberada (§I.R19):

- **Transferencias y ajustes: bloqueados** si dejan negativo. Ahí sí hay tiempo de contar.
- **Consumo en campo: siempre aceptado.** El producto ya se aplicó. Bloquear al operario solo lograría que deje de registrar consumo, y perderías el dato *y* el certificado. El movimiento se crea, el saldo queda negativo, se marca `requires_adjustment` y salta una alerta crítica para el admin, que hace el conteo físico y ajusta.

### N.6 Alertas

Stock bajo mínimo por ubicación · producto por vencer (30 días) · producto vencido con saldo · saldo negativo · discrepancia entre proyección y movimientos · consumo anómalo (>2σ del promedio por m² para ese tipo de servicio — detecta tanto errores de carga como desvío de producto).

### N.7 Costo

`unit_cost_cents` por lote. El costo de un servicio usa el costo del lote consumido (FIFO por vencimiento). Con la inflación argentina, un costeo por precio promedio del catálogo da números falsos en tres meses: **el costo tiene que salir del lote**.

---

## O. CAJA

### O.1 Principio

**Contabilidad de partida simple, append-only, sin edición.** Cada caja es una cuenta. Cada peso que entra o sale es un asiento inmutable. El saldo es la suma. Nunca se guarda un saldo mutable que se pueda desincronizar.

### O.2 Flujo

```
Operario inicia jornada
   └─► caja OPEN (saldo inicial = sobrante de la rendición anterior, normalmente 0)

Cobra en efectivo $45.000
   └─► payment(CASH, 45000) ──[misma transacción]──► cash_movement(+45000, SERVICE_PAYMENT)

Carga combustible $12.000 (si la empresa lo habilita)
   └─► cash_movement(−12000, EXPENSE) + foto del ticket

Fin de jornada: esperado = Σ movimientos = $148.000
   └─► el operario declara $145.000  ──► cash_closure DECLARED, diferencia −$3.000

Admin cuenta y recibe $145.000
   └─► registra received = 145000, motivo "faltó vuelto de un cliente"
   └─► cash_movement(−145000, HANDOVER) + cash_movement(−3000, ADJUSTMENT)
   └─► closure RECONCILED, saldo de la caja = 0
```

### O.3 Reglas anti-inconsistencia

1. **Pago y movimiento de caja nacen juntos o no nacen.** Una sola transacción de DB.
2. **Sin edición ni borrado.** Trigger que rechaza `UPDATE`/`DELETE` en `cash_movements`. Corrección = reversa.
3. **El esperado se calcula, no se guarda.** Imposible que "no coincida" con los movimientos.
4. **Toda rendición termina en saldo cero.** La diferencia se absorbe con un asiento de ajuste explícito, aprobado y auditado. Ninguna caja arrastra un descuadre.
5. **Una sola rendición abierta por caja**, garantizado por índice único parcial.
6. **Quien rinde no aprueba** (excepción documentada en §B.5, marcada `self_approved`).
7. **Diferencia por encima de la tolerancia** exige motivo escrito y aprobación de `Admin`+.
8. **Transferencias no tocan la caja del operario.** Van a la cuenta de la empresa. Confundir esto es el error más común y produce faltantes fantasma.
9. **Todo en centavos enteros.**

### O.4 Reportes de caja

Historial por operario · diferencias acumuladas por operario (indicador de gestión, y de honestidad) · efectivo pendiente de rendición en tiempo real · tiempo promedio entre cobro y rendición · antigüedad del efectivo en la calle.

---

## P. REPORTES

Todos con filtros de fecha, operario, cliente, tipo de servicio y zona. Export CSV/XLSX. Los que superan 5.000 filas se generan en background.

**Operaciones**
- Servicios por estado y período
- Servicios completados vs. planificados (tasa de cumplimiento)
- Reprogramaciones por motivo — *señala si el problema es el cliente o la planificación*
- Ausencias del cliente por cliente — *identifica al cliente que hace perder viajes*
- Viajes desperdiciados y su costo estimado
- Servicios sin certificado emitido

**Productividad**
- Servicios por operario / día / semana
- Tiempo efectivo promedio por tipo de servicio
- Tiempo de traslado vs. tiempo de trabajo (relación clave: si el traslado supera el 40%, hay problema de zonificación)
- Puntualidad: llegada real vs. estimada
- Tasa de rechazo de cierres por operario — *calidad del registro*

**Clientes**
- Ranking por facturación
- Frecuencia y antigüedad
- Clientes en riesgo (contrato sin renovar, sin servicio en N días)
- Revisitas de garantía por cliente — *detecta tratamientos que no funcionaron*
- Rentabilidad por cliente (ingreso − insumo − tiempo − traslado)

**Insumos e inventario**
- Consumo por producto y período
- Consumo por m² por tipo de servicio (detección de anomalías)
- Valorización de stock por ubicación
- Rotación y productos por vencer
- Ajustes de inventario por operario — *indicador de control*

**Ingresos y efectivo**
- Facturación por período, tipo de servicio, zona y origen (contrato vs. puntual)
- Cobrado por método
- Ticket promedio
- Cuentas por cobrar por antigüedad
- Efectivo en la calle
- Diferencias de rendición acumuladas

**Rentabilidad**
- Margen por servicio (precio − insumos a costo de lote − mano de obra imputada − traslado estimado)
- Margen por tipo de servicio y por contrato
- Costo de garantías (revisitas sin cargo) — *un número que casi nadie mide y que suele doler*

**Sanitarios / cumplimiento**
- Certificados emitidos por período
- Servicios completados sin certificado (riesgo de incumplimiento)
- Trazabilidad de producto: dónde se aplicó el lote X — *crítico ante una denuncia o intoxicación*
- Matrículas y libretas próximas a vencer
- Tendencia de plagas por ubicación (Fase 2, con estaciones de monitoreo)

**Implementación:** vistas SQL para lo simple, y **vistas materializadas refrescadas de noche** para lo agregado pesado (rentabilidad, consumo por m²). No hacer un data warehouse. No hacer BI. Los reportes se leen desde réplica cuando exista (§R.5).

---
