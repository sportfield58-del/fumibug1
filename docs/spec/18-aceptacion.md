<!-- Extraído de docs/MASTER_SPEC.md · secciones §W -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## W. CRITERIOS DE ACEPTACIÓN

Formato: verificable, binario, testeable. Si un criterio no se puede convertir en un test, está mal escrito.

### W.1 Alta de servicio
- [ ] Se crea con cliente, ubicación, tipo, fecha y precio en una sola pantalla, sin recargar.
- [ ] Cliente y ubicación se pueden crear inline sin perder lo cargado.
- [ ] El precio se autocompleta desde la lista vigente a la fecha; solo `service.price.override` puede editarlo.
- [ ] Sin datos obligatorios queda `DRAFT`; completo pasa a `SCHEDULED`.
- [ ] Aparece en el planificador en el panel "sin asignar".
- [ ] Se registra `audit_log` con `action = service.created`.
- [ ] Un usuario de otro tenant recibe `404` al consultarlo por ID.

### W.2 Publicar ruta ← *el flujo más crítico del sistema*
- [ ] La ruta tiene operario asignado y fecha.
- [ ] Tiene al menos un stop.
- [ ] Todos los stops referencian servicios en `ASSIGNED`.
- [ ] El operario tiene libreta sanitaria vigente a la fecha de la ruta. **Bloqueante.**
- [ ] Si falta stock de un insumo requerido, se advierte con el faltante exacto (no bloquea).
- [ ] `POST /routes/:id/validate` devuelve la lista completa de problemas **sin** publicar.
- [ ] El admin confirma en un modal que resume operario, fecha, cantidad de stops y horario.
- [ ] La publicación es **atómica**: ruta → `PUBLISHED`, todos los servicios → `DISPATCHED`, orden congelado, notificación creada. Si falla cualquier paso, no cambia nada.
- [ ] Se genera notificación push al operario.
- [ ] El operario ve la ruta en `/field/today` en menos de 5 segundos.
- [ ] Un segundo intento con el mismo `Idempotency-Key` devuelve el mismo resultado sin duplicar nada.
- [ ] Se registra `audit_log` con severidad `INFO` y los IDs afectados.
- [ ] Publicar con `If-Match` de versión vieja devuelve `409`.
- [ ] **Test de concurrencia:** dos publicaciones simultáneas → una `200`, otra `409`; nunca doble notificación.

### W.3 Ejecución de servicio (operario)
- [ ] Con el avión activado desde el inicio, el operario completa el flujo entero y no ve un solo error bloqueante.
- [ ] Al recuperar señal, todo sincroniza sin intervención en menos de 60 segundos.
- [ ] Reintentar la sincronización **no duplica** sesión, pago, consumo ni fotos.
- [ ] Cerrar la app a mitad del servicio y reabrirla mantiene el estado exacto y el cronómetro correcto.
- [ ] `finish` sin foto de "después" devuelve `422` con el faltante nombrado explícitamente.
- [ ] Permiso de ubicación denegado: el flujo completo funciona igual y se registra `gps_status = 'DENIED'`.
- [ ] Cada foto se comprime a menos de 300 KB y sin EXIF de GPS.
- [ ] El servicio queda en `PENDING_VALIDATION` y aparece en la cola del admin.

### W.4 Inventario
- [ ] Consumir genera `service_supply_usage` **y** `inventory_movement` en la misma transacción; si uno falla, no queda ninguno.
- [ ] Con `dilution_rate` cargado, ingresar 8 L de mezcla descuenta el equivalente en concentrado y guarda ambos valores.
- [ ] El descuento sale del `stock_location` del operario, no del depósito.
- [ ] Una transferencia genera exactamente dos movimientos espejo.
- [ ] Un consumo que deja saldo negativo se acepta, marca `requires_adjustment` y genera alerta crítica.
- [ ] Una transferencia que dejaría negativo se rechaza con `422`.
- [ ] Un lote vencido no aparece como opción de consumo.
- [ ] Intentar `UPDATE` sobre `inventory_movements` falla a nivel de base de datos.
- [ ] El job de reconciliación detecta y reporta cualquier diferencia entre proyección y suma de movimientos.

### W.5 Caja y rendición
- [ ] Un pago en efectivo genera el `cash_movement` en la misma transacción. Test que fuerza fallo del segundo insert verifica que el pago tampoco quedó.
- [ ] Un pago por transferencia **no** toca la caja del operario.
- [ ] El esperado se calcula desde los movimientos; no existe campo de saldo mutable.
- [ ] Diferencia mayor a la tolerancia exige motivo y aprobación de `Admin`+.
- [ ] Tras conciliar, el saldo de la caja queda exactamente en cero.
- [ ] Anular un pago genera movimiento inverso; ambos quedan visibles.
- [ ] Un operario no puede ver la caja de otro (`404`).
- [ ] Autoaprobación queda marcada `self_approved = true` y aparece en el reporte de auditoría.

### W.6 Certificado
- [ ] Solo se emite sobre servicio `COMPLETED` y validado.
- [ ] La numeración es correlativa sin huecos. **Test de concurrencia:** 20 emisiones simultáneas producen 20 números consecutivos únicos.
- [ ] El PDF incluye los 12 campos obligatorios de §C.21.
- [ ] Si un producto aplicado no tiene número de registro, la emisión falla nombrando el producto.
- [ ] Solo un DT con matrícula vigente a la fecha del servicio puede firmar.
- [ ] Un certificado firmado no se modifica: intentarlo devuelve `422`.
- [ ] Cambiar el nombre del insumo después de emitir no altera el certificado (snapshot).
- [ ] El QR resuelve a `/public/verify/:token` y muestra únicamente número, fecha, cliente y estado.
- [ ] Reabrir el servicio anula el certificado y lo registra como `CRITICAL`.

### W.7 Multi-tenancy
- [ ] Test automatizado que recorre **todos** los endpoints con un usuario del tenant A e IDs del tenant B: `404` en el 100%.
- [ ] Test de schema que verifica que toda tabla de negocio tiene `tenant_id NOT NULL`.
- [ ] Un `findMany` sin contexto de tenant lanza excepción, no devuelve filas.
- [ ] Con RLS activa y un `tenant_id` incorrecto en sesión, la query devuelve cero filas.
- [ ] El path de Storage empieza por `tenant_id` y la policy del bucket lo verifica.

### W.8 Auditoría
- [ ] Toda mutación de §I.R41 genera entrada con actor, antes, después, IP y `requestId`.
- [ ] El log se escribe en la misma transacción: si la mutación revierte, el log también.
- [ ] `UPDATE` y `DELETE` sobre `audit_logs` fallan en la base.
- [ ] Las acciones `CRITICAL` se pueden filtrar en una vista.
- [ ] Ningún registro de auditoría contiene contraseñas, tokens ni datos personales sensibles.

---

