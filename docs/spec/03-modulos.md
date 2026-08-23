<!-- Extraído de docs/MASTER_SPEC.md · secciones §C -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## C. MÓDULOS

Los numero como en tu prompt y agrego los que faltan (21–24).

### C.1 Dashboard
Vista distinta por rol. Admin: servicios de hoy por estado (semáforo), operarios activos, servicios sin asignar, alertas (stock bajo, matrículas por vencer, rendiciones pendientes, certificados sin firmar), cobrado hoy efectivo/transferencia. Owner: los 4 números del negocio (facturado mes, efectivo pendiente de rendición, servicios completados, ticket promedio). Operario: **no tiene dashboard**, entra directo a su ruta del día.

### C.2 Usuarios
Alta con rol, asignación de color y avatar (identificación rápida en el planificador), datos de operario (matrícula/libreta sanitaria con vencimiento, licencia de conducir, vehículo asignado), estado activo/suspendido, reseteo de PIN, forzar cierre de sesión. **Alerta automática a 30 días del vencimiento de libreta sanitaria** — un operario con libreta vencida no puede tener stops asignados.

### C.3 Clientes
Persona física o jurídica. Razón social, nombre de fantasía, CUIT/CUIL, condición IVA (se necesita para Fase 3 de facturación, se pide desde ya porque conseguirlo después es imposible), contactos múltiples con rol (quien contrata ≠ quien abre la puerta ≠ quien paga), condición de pago (contado / cuenta corriente / abono), notas internas, tags, historial completo.

### C.4 Ubicaciones (`service_locations`)
Un cliente tiene N ubicaciones. Dirección normalizada + `lat/lng` + **link de acceso ya resuelto**. Datos operativos que ahorran llamadas: piso/depto, cómo se entra, hay perro, hay portero, horario de atención, ventana horaria permitida, tiempo de acceso, superficie en m², tipo de establecimiento (vivienda / gastronómico / industria alimenticia / depósito / escuela / consorcio), plagas históricas, contacto en sitio. **Croquis/plano subido** (Fase 2, para estaciones de monitoreo).

### C.5 Contratos recurrentes (`service_contracts`) — MÓDULO NUEVO, MUST HAVE
Lo que faltaba en tu planteo y es el que sostiene la facturación.

- Cliente + ubicación(es) + tipo de servicio + frecuencia (`RRULE` simplificada: mensual, bimestral, trimestral, semestral, día del mes o día de semana N).
- Precio del abono y precio por visita, con **lista de precios versionada por vigencia** (obligatorio en Argentina: los precios se actualizan cada 2–3 meses; sin versionado no podés reconstruir cuánto valía un servicio de marzo).
- Vigencia desde/hasta, renovación automática, aviso de vencimiento.
- **Generador**: un job diario crea los `services` en estado `SCHEDULED` con N días de anticipación (configurable, default 30). Idempotente por `(contract_id, scheduled_date)`.
- Cancelación de contrato → los servicios futuros generados y aún no publicados se cancelan en cascada; los publicados requieren confirmación explícita.

### C.6 Servicios
Unidad de trabajo comercial. Origen: manual, desde contrato, desde presupuesto (Fase 2), o **revisita de garantía** (`is_warranty_visit`, no genera ingreso, cuenta como costo). Campos: tipo (desinsectación / desratización / desinfección / control de aves / termitas / otro), plagas objetivo, ubicación, ventana horaria pedida por el cliente, duración estimada, precio, prioridad, notas para el operario, **operarios requeridos (1..N)** — hay trabajos de cuadrilla y tu modelo asumía uno solo.

### C.7 Planificador (Dispatch)
Vista día/semana con calendario de operarios en columnas. Servicios sin asignar en un panel lateral con filtro por zona. Drag & drop del servicio a la columna del operario. Detección de conflictos en vivo: solapamiento horario, ventana del cliente violada, operario sin libreta vigente, operario sin stock del químico requerido, exceso de horas. **No bloquea, advierte** (salvo libreta vencida, que sí bloquea).

### C.8 Rutas
Una ruta = un operario + una fecha + N stops ordenados. Estados en §D. Funciones: reordenar stops (drag), estimar tiempos de traslado (Fase 2 con Distance Matrix; MVP: campo manual `travel_minutes`), duplicar ruta, publicar, despublicar con reglas, cancelar. **Publicar es un acto atómico con snapshot** (§I.R12).

### C.9 Operarios (vista admin)
Estado en vivo del día: en qué stop está, hace cuánto, atrasado sí/no. Stock de su vehículo. Caja abierta y monto esperado. Historial de productividad.

### C.10 Ejecución de servicios (app operario)
El módulo más importante. Detallado en §F y §G.2.

### C.11 Evidencias
Fotos antes/durante/después con categoría obligatoria, firma del cliente en canvas, audio de observación (Fase 2). Compresión client-side, upload directo a Storage con URL firmada, cola offline. Metadatos: `taken_at` (device), `uploaded_at` (server), `lat/lng/accuracy`, hash. **Sin EXIF de ubicación** — se strippea y se guarda la coordenada por separado, para no filtrar datos en el archivo.

### C.12 Insumos (catálogo)
Producto con: nombre comercial, principio activo, concentración, **registro ANMAT o SENASA** (obligatorio para el certificado), tipo (insecticida / rodenticida / desinfectante / cebo / trampa / EPP), unidad de compra, unidad de aplicación, **tasa de dilución** (ej: 20 ml/L), dosis recomendada por m², plazo de reingreso en horas, MSDS (PDF adjunto), costo unitario vigente, control de lote sí/no, stock mínimo.

### C.13 Inventario
Multi-ubicación: depósito central + un `stock_location` por operario/vehículo. Movimientos tipados. Lote y vencimiento. Alertas de stock mínimo y de producto por vencer. Detalle completo en §N.

### C.14 Pagos
Registro de cobro asociado a un servicio (o a un contrato/cuenta corriente). Método: efectivo, transferencia, MercadoPago, tarjeta (link), cheque, cuenta corriente. Cobro parcial y seña. Comprobante fotografiado en el caso de transferencia. **Anulación por reversa, nunca edición.**

### C.15 Caja
Una caja abierta por operario por jornada. Se acredita automáticamente todo pago en efectivo. Se debitan gastos rendidos (combustible, peaje) si están habilitados. Detalle en §O.

### C.16 Rendiciones
Cierre de caja: esperado (calculado) vs. contado (declarado) vs. recibido (confirmado por admin). Diferencia justificada y aprobada. Genera asiento de ajuste. §O.

### C.17 Reportes
§P.

### C.18 Notificaciones
Tres canales, escalonados: **in-app** (MVP), **push web** (MVP, para "tu ruta fue publicada" y "tu ruta cambió"), **WhatsApp** (Fase 2; MVP = botón que abre `wa.me` con mensaje pre-armado, que es 5% del esfuerzo y 80% del valor). Email transaccional (Resend) para certificados.

### C.19 Configuración
Datos de la empresa (razón social, CUIT, **número de habilitación como empresa de control de plagas**, logo, dirección, teléfono), directores técnicos y sus matrículas, plantilla de certificado, tipos de servicio, zonas, listas de precios, parámetros operativos (radio de geocerca de advertencia, días de anticipación del generador de contratos, tolerancia de diferencia de caja).

### C.20 Auditoría
Log inmutable append-only de toda mutación sensible. §K.10.

### C.21 Certificados — MÓDULO NUEVO, MUST HAVE
Genera el PDF de constancia de servicio con: datos de la empresa y su habilitación, cliente y domicilio tratado, fecha y hora, tipo de tratamiento y plagas objetivo, **productos aplicados con nombre comercial, principio activo, registro ANMAT/SENASA, concentración, dilución y lote**, método de aplicación, superficie tratada, plazo de reingreso, recomendaciones, operario interviniente y su libreta sanitaria, **Director Técnico, matrícula y firma**, número correlativo de certificado, QR de verificación pública.

Reglas: se genera **desde los datos reales de la sesión** (no se tipea), requiere servicio en `COMPLETED` y validado, numeración correlativa por tenant sin huecos, una vez firmado es inmutable (corrección = anulación + emisión de uno nuevo referenciando al anulado).

**Este módulo es el que hace que valga la pena pagar el software.**

### C.22 Estaciones de monitoreo (`monitoring_stations`) — Fase 2, pero modelar ahora
Para clientes gastronómicos/industriales con abono: puntos numerados fijos (cebaderas, trampas de luz, feromonas) mapeados en la ubicación. En cada visita el operario registra por estación: consumo (nulo/bajo/medio/alto), captura, reposición, estado físico. Genera el **informe de tendencia de plagas**, que es exactamente lo que pide una auditoría BRC/HACCP en la industria alimenticia. Es el upsell natural del producto.

### C.23 Multi-tenancy
§Q.

### C.24 Presupuestos / Cotizaciones — Fase 2
Presupuesto → aceptado → genera servicio o contrato. Fuera del MVP: en el MVP el presupuesto se hace por WhatsApp y el admin carga el servicio ya cerrado.

---
