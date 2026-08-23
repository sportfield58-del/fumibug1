<!-- Extraído de docs/MASTER_SPEC.md · secciones §I -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## I. REGLAS DE NEGOCIO

Cada regla tiene ID. Los tests de integración deben referenciarlas (`test('R14: ...')`). Si una regla no tiene test, no está implementada.

### Servicios y ejecución

- **R1** — Un servicio no puede pasar a `SCHEDULED` sin cliente, ubicación con coordenadas o dirección validada, tipo de servicio, fecha objetivo y precio.
- **R2** — Un servicio solo puede iniciarse por el operario asignado a su `route_stop`, y solo si la ruta está `PUBLISHED` o `IN_PROGRESS`.
- **R3** — Un operario no puede tener dos sesiones abiertas simultáneamente. Garantizado por índice único parcial en DB, no solo por código.
- **R4** — Un servicio no se cierra sin **checklist de cierre completo**: mínimo 1 foto `BEFORE`, mínimo 1 foto `AFTER`, al menos un insumo registrado o justificación de "no se aplicó producto", decisión de pago tomada (cobrado / cuenta corriente / no corresponde), y firma del cliente o motivo de ausencia de firma. Los mínimos son configurables por `service_type`, pero **nunca pueden ser cero para fotos**.
- **R5** — Un servicio `COMPLETED` es inmutable. Solo `Admin`/`Owner` puede reabrirlo, dentro de 7 días, con motivo. La reapertura anula cualquier certificado emitido.
- **R6** — Cancelar un servicio requiere motivo de lista cerrada y decisión explícita de si es facturable.
- **R7** — Un servicio con `is_warranty_visit = true` tiene precio 0 forzado, no admite cobro, y se imputa como costo al servicio padre en el reporte de rentabilidad.
- **R8** — Un servicio `PARTIALLY_COMPLETED` genera automáticamente un servicio hijo en `SCHEDULED` con `origin = 'PARTIAL_FOLLOWUP'` y `parent_service_id` apuntando al original.
- **R9** — Un `route_stop` marcado `NO_SHOW` exige: al menos una foto categoría `FACADE`, ≥5 minutos transcurridos desde `arrived_at`, y registro del intento de contacto.
- **R10** — El tiempo efectivo de un servicio es `ended_at − started_at − Σ(pausas)`. Una sesión abierta más de 12 horas se cierra automáticamente por job, se marca `auto_closed = true` y se manda a `PENDING_VALIDATION` con alerta.

### Rutas

- **R11** — Un operario tiene como máximo una ruta activa por fecha.
- **R12** — **Publicar una ruta es atómico.** En una sola transacción: valida guards, cambia la ruta a `PUBLISHED`, pasa todos los servicios de `ASSIGNED` a `DISPATCHED`, congela el orden, genera notificación. Si algo falla, no se publica nada.
- **R13** — Una ruta `PUBLISHED` admite edición restringida: se pueden **agregar** stops, **reordenar** stops en `PENDING`, y **cancelar** stops. **No** se puede quitar un stop con sesión iniciada, ni cambiar el operario (para eso está "reasignar ruta"). Toda edición post-publicación genera notificación al operario y entrada de auditoría.
- **R14** — Despublicar solo es posible si ningún stop salió de `PENDING`.
- **R15** — No se puede asignar un servicio a un operario con `license_expires_at < route_date`. **Bloqueo duro**, no advertencia: es responsabilidad legal.

### Inventario

- **R16** — Todo consumo de insumo genera un `inventory_movement` de tipo `CONSUMPTION` en la **misma transacción** que el `service_supply_usage`. Nunca uno sin el otro.
- **R17** — El stock se descuenta del `stock_location` del **operario que ejecutó**, no del depósito.
- **R18** — Si el producto tiene `dilution_rate`, el operario carga la mezcla aplicada y el sistema calcula y descuenta el `concentrate_equivalent`. Ambos valores se guardan.
- **R19** — El stock **no puede quedar negativo**. Excepción: el consumo registrado en campo siempre se acepta (el trabajo ya se hizo), pero si el saldo quedara negativo se crea el movimiento, se marca `requires_adjustment = true` y se genera alerta crítica para el admin. Bloquear al operario acá sería peor: dejaría de registrar consumo.
- **R20** — Un lote vencido no puede seleccionarse para consumo nuevo. Si ya se consumió, queda registrado y se marca en el certificado.
- **R21** — Las transferencias entre `stock_locations` generan dos movimientos espejo (`TRANSFER_OUT` / `TRANSFER_IN`) en una transacción, con el mismo `reference_id`.
- **R22** — Ajustar inventario requiere `inventory.adjust`, motivo obligatorio, y genera audit `severity = WARNING`.
- **R23** — La proyección `inventory` se actualiza en la misma transacción que el movimiento, con `SELECT ... FOR UPDATE` sobre la fila de saldo. Un job nocturno reconcilia contra la suma de movimientos.

### Dinero

- **R24** — Todo pago en efectivo genera un `cash_movement` en la caja del operario receptor, en la misma transacción. Sin excepción.
- **R25** — Los pagos por transferencia **no** impactan la caja del operario; van a la cuenta de la empresa y exigen comprobante fotografiado.
- **R26** — Un pago no se edita. Se anula (`VOIDED`) generando un `cash_movement` inverso, y se registra uno nuevo si corresponde.
- **R27** — El monto esperado de una caja es `Σ(cash_movements desde la última rendición)`. Se calcula, nunca se almacena como campo mutable.
- **R28** — Una rendición con diferencia mayor a la tolerancia del tenant exige motivo escrito y aprobación de `Admin`+.
- **R29** — La diferencia aprobada genera un `cash_movement` de tipo `ADJUSTMENT` que deja el saldo en cero. La caja nunca "arrastra" diferencias silenciosamente.
- **R30** — Un operario con rendición `DECLARED` sin conciliar no puede iniciar una ruta nueva pasadas 24 h (configurable).
- **R31** — Todos los montos son enteros en centavos. Ninguna operación de dinero usa punto flotante en ningún punto del stack, incluido el frontend.
- **R32** — El precio de un servicio se congela al crearlo, tomándolo de la lista vigente en esa fecha. Cambiar la lista de precios **no** modifica servicios existentes.

### Certificados

- **R33** — Solo se emite certificado sobre un servicio `COMPLETED` y validado.
- **R34** — La numeración es correlativa por tenant, sin huecos, obtenida con bloqueo sobre un contador. Nunca `MAX(number)+1`.
- **R35** — Al emitir se congela el `snapshot` con todos los datos. Cambios posteriores en catálogos no afectan certificados emitidos.
- **R36** — Solo un usuario con permiso `certificate.sign`, matrícula cargada y **vigente a la fecha del servicio**, puede firmar.
- **R37** — Un certificado firmado es inmutable. Corregir = anular (con motivo) + emitir uno nuevo con `replaces_certificate_id`.
- **R38** — El certificado debe incluir, para cada producto aplicado: nombre comercial, principio activo, concentración, autoridad y número de registro, lote y dilución. Si falta alguno, la emisión falla con error explícito señalando qué producto está incompleto.

### Multi-tenancy y datos

- **R39** — Ninguna query de negocio se ejecuta sin `tenant_id`. Enforced en tres capas: extensión de Prisma, RLS de Postgres, y test automatizado que falla si aparece un `findMany` sin filtro de tenant.
- **R40** — Un usuario nunca ve datos de un tenant al que no pertenece, ni siquiera un `404` distinguible de un `403`: los recursos de otro tenant devuelven **`404`**, no `403`, para no filtrar existencia.
- **R41** — Toda mutación sensible (estados, dinero, inventario, permisos, publicación) escribe en `audit_logs`. El audit se escribe **en la misma transacción** que la mutación.
- **R42** — Los `audit_logs`, `cash_movements` e `inventory_movements` tienen triggers que rechazan `UPDATE` y `DELETE`.

### Sincronización offline

- **R43** — Toda acción originada en el dispositivo lleva `client_event_id` (UUID v4 generado en el cliente). El servidor deduplica: si ya procesó ese ID, devuelve el resultado original con `200` y `X-Idempotent-Replay: true`.
- **R44** — Se guardan dos tiempos: `occurred_at` (reloj del dispositivo) y `recorded_at` (reloj del servidor). Si la diferencia supera 15 minutos, se marca `clock_skew_flag` y se muestra al admin. **No se corrige silenciosamente**: es un dato de auditoría.
- **R45** — Si al sincronizar el servidor detecta que el servicio fue cancelado mientras el operario trabajaba offline, **acepta el registro** y marca `conflict_flag = true` para revisión humana. Nunca se descarta trabajo real.
- **R46** — La cola de sincronización respeta el orden causal por entidad: no se sube una foto antes que la sesión que la contiene. Se implementa con dependencias explícitas entre eventos encolados.

### GPS

- **R47** — El GPS **nunca** bloquea una acción. Si falla, se registra `gps_status` y se continúa.
- **R48** — Si `distance_from_location_m` supera el radio configurado, se registra y se advierte al operario, pero se permite continuar. La geocerca es un dato de auditoría, no un control de acceso.

---
