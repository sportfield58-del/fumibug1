<!-- Extraído de docs/MASTER_SPEC.md · secciones §F -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## F. FLUJO DEL OPERARIO

### F.1 Principios de diseño de este flujo

Antes del paso a paso, las cinco reglas que gobiernan la app de campo:

1. **Nada se pierde nunca.** Toda acción se escribe primero en IndexedDB y después se sincroniza. Si el celular se apaga, al volver está todo.
2. **Ninguna acción crítica requiere conexión.** Iniciar, terminar, sacar foto, cargar insumo, registrar pago: todo funciona offline.
3. **Máximo 2 taps para la acción principal.** La app abre en la ruta del día, el stop actual está expandido, el botón grande dice lo único que corresponde hacer ahora.
4. **El GPS nunca bloquea.** Si falla, se registra el motivo y se sigue.
5. **Si algo falla, el mensaje dice qué hacer**, no qué pasó. "Sin señal — se guardó, se envía solo" y no "Error 503".

### F.2 Camino feliz

1. **Login.** Usuario (no email) + PIN de 6 dígitos. Sesión de 30 días. Opción de biometría si el dispositivo la soporta.
2. **Ruta del día.** Lista vertical de stops en orden, con hora estimada, nombre del cliente, dirección corta y chip de estado. Arriba: progreso (3 de 7) y monto cobrado en el día. Abajo: botón "Cerrar jornada" (deshabilitado hasta que todos los stops estén en estado terminal).
3. **Abrir un stop.** Muestra: cliente, dirección completa, cómo entrar, contacto y botón de llamar, plagas objetivo, notas del admin, servicios anteriores en esa ubicación (2 últimos), precio a cobrar y método esperado.
4. **Navegar.** Dos botones: Google Maps y Waze. Abren `geo:` / deep link con coordenadas. Al tocar, el stop pasa a `EN_ROUTE` (opt-in, no obligatorio).
5. **Llegué.** Botón grande. Captura coordenada + hora. Si la distancia a la ubicación registrada supera el radio configurado, muestra advertencia no bloqueante: "Estás a 800 m de la dirección registrada. ¿Confirmás?".
6. **Iniciar servicio.** Arranca el cronómetro. Muestra el checklist del tipo de servicio.
7. **Trabajo.** Fotos "antes" (mínimo 1), observaciones, fotos "después" (mínimo 1). Cada foto pide categoría con un tap.
8. **Insumos.** Lista precargada con lo que el operario tiene en el vehículo. Selecciona producto → lote (autoseleccionado si hay uno solo) → cantidad. **Se ingresa lo que efectivamente aplicó**, con el switch "concentrado / mezcla preparada" resuelto por el sistema vía `dilution_rate`.
9. **Pago.** Monto esperado precargado. Método: Efectivo / Transferencia / No cobra (cuenta corriente). Si transferencia: foto del comprobante obligatoria. Si el monto difiere del esperado: motivo obligatorio.
10. **Firma del cliente.** Canvas, nombre y aclaración de quien firma. Si el cliente se niega o no hay nadie que pueda firmar: "sin firma" + motivo.
11. **Cerrar.** Valida el checklist. Si falta algo, lo dice concretamente ("Falta al menos una foto de después"). Cierra el cronómetro, el stop pasa a `DONE`, el servicio a `PENDING_VALIDATION`.
12. **Siguiente.** La app avanza sola al próximo stop.
13. **Cerrar jornada.** Resumen: servicios hechos, tiempo total, efectivo en mano. Botón "Rendir".
14. **Rendición.** Declara el efectivo contado. Si difiere del esperado, motivo obligatorio. Genera `cash_closure` en `DECLARED`.

### F.3 Casos excepcionales — comportamiento exigido

| Caso | Comportamiento |
|---|---|
| **Sin conexión** | Todo el flujo funciona. Indicador persistente arriba: "Sin conexión — 4 acciones pendientes". Al recuperar señal, sincroniza en background y el indicador pasa a verde. **Nunca se muestra un spinner bloqueante por falta de red.** |
| **GPS desactivado o denegado** | Se pide el permiso una vez, con explicación previa ("necesitamos la ubicación para dejar constancia de la visita"). Si se niega: se continúa, se registra `gps_status = 'DENIED'` y se marca el registro. **Jamás se bloquea el trabajo.** |
| **GPS impreciso** (>100 m) | Se guarda igual, con `accuracy_m`. El admin ve el dato. No se rechaza. |
| **Cliente ausente** | Botón "Cliente ausente" en el stop. Exige: 1 foto de la fachada + intento de llamada registrado (tap en "llamé") + espera mínima de 5 minutos desde `ARRIVED`. Stop → `NO_SHOW`, servicio → `RESCHEDULED`, notificación al admin. |
| **Servicio cancelado mientras iba** | Push + banner rojo. Si la app está offline y el operario igual ejecuta, al sincronizar el servidor **acepta la sesión** (el trabajo se hizo) y marca `conflict_flag` para revisión administrativa. No se descarta trabajo real. |
| **Cambio de horario / ruta** | Push "tu ruta cambió". La app hace merge: los stops ya ejecutados no se tocan, los pendientes se reordenan. Se resalta lo que cambió. |
| **Falta de insumo** | En "Insumos", opción "no tenía stock" → registra el faltante, no consume, marca el servicio `PARTIALLY_COMPLETED` si el producto era el principal. Notifica al admin. |
| **Cantidad de químico mal cargada** | Editable mientras la sesión está abierta. Después del cierre, solo el admin corrige (genera movimiento de ajuste de inventario, nunca edita el movimiento original). |
| **Pago distinto al esperado** | Se permite con motivo obligatorio de lista cerrada (descuento pactado, cobro parcial, cliente pagó de más). Queda `payment_variance` visible en el reporte. |
| **Batería baja / app cerrada a mitad de servicio** | La sesión queda `OPEN` con estado local persistido. Al reabrir, la app retoma exactamente donde estaba, con el cronómetro corregido por `started_at`. |
| **Dos sesiones abiertas** | Imposible por índice único parcial en DB. La UI muestra "tenés un servicio sin cerrar" y obliga a resolverlo. |
| **El operario terminó la jornada pero le falta rendir** | La caja queda `OPEN`. Al día siguiente no puede iniciar ruta nueva sin rendir la anterior (configurable). |

---
