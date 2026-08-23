# FUMIBUG — Especificación Funcional y Técnica

**Versión:** 1.0.0
**Fecha:** 2026-08-21
**Estado:** Draft para revisión del Product Owner
**Destino:** SOURCE OF TRUTH para Claude Code + OpenCode
**Regla de oro:** si el código contradice este documento, el código está mal. Si este documento está mal, se corrige *acá primero* mediante PR, y recién después se toca el código.

---

## 0. RESUMEN EJECUTIVO — LO QUE CAMBIÉ DE TU PLANTEO

Antes de la especificación, las siete correcciones estructurales. Cada una está desarrollada más abajo.

| # | Tu planteo | Problema | Propuesta |
|---|---|---|---|
| 1 | Estados mezclados en `service` (`EN_ROUTE`, `ARRIVED`, `PUBLISHED`...) | Estás modelando tres ciclos de vida distintos en una sola máquina de estados. `PUBLISHED` es propiedad de la **ruta**, `ARRIVED` es propiedad de la **visita**. Va a explotar en cuanto un servicio se reprograme o se visite dos veces. | Tres entidades con tres máquinas separadas: `service` (ciclo comercial), `route_stop` (ciclo de la visita planificada), `service_session` (registro de ejecución). §D |
| 2 | No aparece nada legal/sanitario | El certificado de desinsectación/desratización firmado por Director Técnico es **el entregable legal** del negocio. Sin eso, Fumibug sigue haciendo certificados en Word. Es el diferencial #1 del producto, no un extra. | Módulo de Certificados como MUST HAVE del MVP. Incluye registro ANMAT/SENASA del producto, lote, principio activo, dilución, plazo de reingreso, DT firmante. §C.21, §N |
| 3 | Servicios sueltos | El grueso de la facturación en control de plagas es **abono recurrente** (mensual/trimestral) con visitas programadas, no trabajos puntuales. Sin recurrencia, el admin carga a mano 300 servicios por mes. | `service_contracts` con regla de recurrencia + generador automático de servicios. MUST HAVE. §C.5 |
| 4 | Inventario global | Los químicos se consumen del **stock del vehículo/operario**, no del depósito. Y el operario aplica *mezcla diluida* mientras el stock es *concentrado*. Si no modelás eso, el stock nunca cierra. | `stock_locations` (depósito + un stock por operario/vehículo) + `dilution_rate` por producto + lote/vencimiento obligatorio. §N |
| 5 | Supabase Auth "o JWT según convenga" | Ambiguo, y hay un problema concreto: los operarios de campo no tienen email corporativo y muchos no tienen email a secas. | Supabase Auth como *identity provider*, NestJS como *authorization*. Operarios entran con usuario + PIN sobre email sintético. §K |
| 6 | Supabase RLS mencionado como solución de aislamiento | Si NestJS se conecta con `service_role`, **RLS no se aplica**. Te da falsa sensación de seguridad. | Defensa en profundidad real: extensión de Prisma que inyecta `tenant_id` en toda query + RLS con `SET LOCAL app.tenant_id` por transacción, con un rol de DB **sin** `BYPASSRLS`. §K.4 |
| 7 | Dos apps Next.js (admin + PWA operario) | Dos deploys, dos design systems, dos sesiones, el doble de superficie para que los agentes se pisen. | Una sola app Next.js con dos route groups (`(admin)` y `(campo)`), service worker scopeado a `/campo`, manifest con `start_url: /campo`. §R.1 |

**Lo que NO voy a construir en el MVP y vos probablemente esperabas:** tracking GPS en tiempo real, optimización automática de rutas, facturación ARCA (ex-AFIP), WhatsApp automatizado, billing/Stripe, offline total. Justificación de cada uno en §S y §Y.2.

---
## A. VISIÓN DEL PRODUCTO

### A.1 Qué problema resuelve

Una empresa de control de plagas vive de coordinar **personas que se mueven** aplicando **sustancias reguladas** en **domicilios de terceros**, cobrando muchas veces en **efectivo**, y emitiendo un **documento con validez sanitaria**. Hoy eso se maneja con WhatsApp, un cuaderno, un Excel y certificados en Word.

Los cuatro dolores concretos:

1. **La coordinación se pierde.** El admin no sabe dónde está cada operario ni si el servicio se hizo. Se entera cuando el cliente reclama.
2. **La evidencia no existe.** Si el cliente dice "no vinieron" o "quedó mal hecho", no hay foto, ni hora, ni firma, ni coordenada.
3. **La plata se diluye.** El operario cobra en efectivo, rinde tres días después, y nadie sabe cuánto debería haber traído.
4. **El certificado es artesanal.** Se rehace a mano cada vez, con riesgo de poner mal el producto, el registro o la fecha. Es el documento que el cliente presenta ante la inspección municipal.

Fumibug convierte esas cuatro cosas en un único flujo con trazabilidad.

### A.2 Usuarios

| Usuario | Contexto real | Implicancia de diseño |
|---|---|---|
| **Dueño / Owner** | Mira el negocio desde el celular, a la noche. Quiere saber cuánto se facturó y cuánto falta rendir. | Dashboard mobile-friendly con 4 números, no un BI. |
| **Administrativo** | Atiende el teléfono, carga servicios, arma la agenda. Trabaja en desktop, muchas horas, con el teléfono en la oreja. | Velocidad de carga > belleza. Teclado, no mouse. Alta de cliente + servicio en menos de 40 segundos. |
| **Supervisor / Coordinador** | Arma rutas, resuelve imprevistos del día, valida cierres. | Vista de "día en vivo" con semáforo de estados. |
| **Operario** | Celular Android de gama baja, pantalla con el sol de frente, guantes, mochila de 20 litros, señal intermitente, batería al 30%. | **Este es el usuario que define el éxito del producto.** Botones enormes, pocos pasos, funciona sin señal, no pierde nada si se cierra la app. |
| **Director Técnico** | Profesional matriculado que firma los certificados. Puede no ser empleado full-time. | Rol propio, con firma cargada y matrícula vigente. Puede firmar en lote. |
| **Cliente final** | No usa el sistema en el MVP. Recibe el certificado. | Fase 2: portal read-only por link firmado. |

### A.3 Qué diferencia esto de un calendario

Un calendario responde "quién va a dónde". Un FSM responde:

- **¿Se hizo realmente?** → sesión de ejecución con inicio/fin, GPS, fotos, firma.
- **¿Con qué se hizo?** → consumo de insumos con lote y dilución, descontado del stock del vehículo.
- **¿Cuánto costó y cuánto entró?** → costo de insumo + tiempo del operario vs. cobro registrado.
- **¿Dónde está la plata?** → caja por operario, rendición con diferencia.
- **¿Qué firmo?** → certificado generado desde los datos reales de la ejecución, no tipeado a mano.
- **¿Qué pasó?** → audit log inmutable de quién cambió qué.

Ese salto —de "agenda" a "sistema de registro operativo, sanitario y financiero"— es el producto.

### A.4 Qué partes son Field Service Management

| Bloque | ¿Es FSM? | Nota |
|---|---|---|
| Clientes, ubicaciones, contratos | Núcleo | Una empresa puede tener N ubicaciones (sucursales). |
| Planificación y despacho (dispatch) | Núcleo | Asignación operario ↔ ventana horaria ↔ ubicación. |
| Rutas y stops | Núcleo | |
| Ejecución móvil con evidencia | Núcleo | Es el corazón. |
| Inventario en vehículo (van stock) | Núcleo FSM | Casi ningún competidor local lo hace bien. |
| Cobro en campo y rendición | Extensión FSM | Fuerte en Argentina por el peso del efectivo. |
| Certificación sanitaria | **Vertical específico** | Esto es lo que un FSM genérico (Jobber, ServiceTitan) no te da para Argentina. |
| Contratos recurrentes | Núcleo | |
| Facturación electrónica | Fuera del MVP | Se integra, no se construye. |

### A.5 Camino a SaaS

El producto nace multi-tenant a nivel de datos y de permisos, pero **monoempresa a nivel comercial**. Fumibug es el `tenant_id = 1` y el cliente de validación. La secuencia:

1. **Fase 1–2:** Fumibug lo usa en producción real. Todo el schema ya lleva `tenant_id`, RLS activo, y ningún query global. Cero funcionalidad de billing.
2. **Fase 3:** segunda empresa (idealmente de otra ciudad, para no competir con Fumibug). Se agregan: onboarding autoservicio, `plans`, `feature_flags`, límites por plan.
3. **Fase 4:** billing (Stripe para internacional / Mercado Pago para Argentina), trial, métricas SaaS.

La decisión crítica es **no** dejar el multi-tenancy "para después". Retrofittear `tenant_id` en 25 tablas con datos productivos es un proyecto de tres semanas y un incidente de fuga de datos esperando pasar.

---
## B. ACTORES, ROLES Y PERMISOS

### B.1 Modelo de permisos elegido

**RBAC con permisos granulares y scope**, no roles hardcodeados en el código.

```
user → membership(tenant) → role → permissions[]
```

- Un `user` puede pertenecer a varios `tenants` (necesario para SaaS y para el soporte de Fumibug).
- El `role` vive **dentro** del tenant. Un tenant puede crear roles propios (Fase 3).
- El código **nunca** pregunta `if (user.role === 'ADMIN')`. Pregunta `if (can(user, 'route.publish'))`.
- Los permisos se resuelven al emitir el token y se cachean en el request; se revalidan contra DB en toda operación de escritura sensible (dinero, inventario, publicación).

**Por qué no ABAC/CASL completo en el MVP:** la complejidad de políticas dinámicas no se paga todavía. Pero el diseño deja lugar: cada permiso admite un `scope` opcional (`own` | `team` | `tenant`), que es lo único de ABAC que realmente se necesita (ej: "el operario ve solo *sus* servicios").

### B.2 Catálogo de permisos

Formato `recurso.acción`. Lista completa del MVP:

```
# Clientes y ubicaciones
customer.read | customer.create | customer.update | customer.archive
location.read | location.create | location.update | location.archive

# Contratos y servicios
contract.read | contract.create | contract.update | contract.cancel
service.read.own | service.read.tenant | service.create | service.update
service.cancel | service.reschedule | service.price.override

# Rutas
route.read.own | route.read.tenant | route.create | route.update
route.publish | route.unpublish | route.cancel

# Ejecución
session.start | session.finish | session.reopen
evidence.upload | evidence.delete
stop.mark_no_show | stop.skip

# Cierre y validación
service.close | service.validate | service.reject

# Certificados
certificate.read | certificate.issue | certificate.sign | certificate.void

# Insumos e inventario
supply.read | supply.create | supply.update
inventory.read.own | inventory.read.tenant
inventory.transfer | inventory.adjust | inventory.allow_negative

# Dinero
payment.read.own | payment.read.tenant | payment.create | payment.void
cash.read.own | cash.read.tenant | cash.close.own
cash.approve_closure | cash.adjust

# Administración
user.read | user.create | user.update | user.deactivate
role.manage | settings.manage | audit.read
report.operational | report.financial
```

### B.3 Matriz rol × permiso (roles semilla)

| Permiso (grupo) | Owner | Admin | Supervisor | Administrativo | Operario | Director Técnico |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Clientes / ubicaciones (CRUD) | ✔ | ✔ | R | ✔ | R (solo de sus stops) | R |
| Contratos | ✔ | ✔ | R | crear/editar | — | — |
| Servicios: ver | tenant | tenant | tenant | tenant | **own** | tenant |
| Servicios: crear / editar | ✔ | ✔ | ✔ | ✔ | — | — |
| Servicios: cancelar / reprogramar | ✔ | ✔ | ✔ | ✔ | — | — |
| **Override de precio** | ✔ | ✔ | — | — | — | — |
| Rutas: armar / editar borrador | ✔ | ✔ | ✔ | ✔ | — | — |
| **Rutas: publicar** | ✔ | ✔ | ✔ | — | — | — |
| **Rutas: despublicar** (con ruta iniciada) | ✔ | ✔ | — | — | — | — |
| Iniciar / finalizar sesión | — | — | — | — | ✔ (own) | — |
| Subir evidencia | — | — | — | — | ✔ (own) | — |
| Marcar cliente ausente | — | — | — | — | ✔ (own) | — |
| **Reabrir servicio cerrado** | ✔ | ✔ | — | — | — | — |
| Validar / rechazar cierre | ✔ | ✔ | ✔ | — | — | — |
| Emitir certificado | ✔ | ✔ | ✔ | ✔ | — | ✔ |
| **Firmar certificado** | — | — | — | — | — | ✔ |
| **Anular certificado** | ✔ | ✔ | — | — | — | ✔ |
| Insumos: catálogo | ✔ | ✔ | R | R | R | R |
| Inventario: ver | tenant | tenant | tenant | tenant | **own** | — |
| Inventario: transferir a operario | ✔ | ✔ | ✔ | — | — | — |
| **Inventario: ajustar** | ✔ | ✔ | — | — | — | — |
| **Inventario: permitir negativo** | ✔ | — | — | — | — | — |
| Registrar pago | ✔ | ✔ | ✔ | ✔ | ✔ (own) | — |
| **Anular pago** | ✔ | ✔ | — | — | — | — |
| Caja: ver | tenant | tenant | tenant | tenant | **own** | — |
| Cerrar su caja (rendir) | — | — | — | — | ✔ | — |
| **Aprobar rendición / ajustar diferencia** | ✔ | ✔ | ✔ (hasta límite) | — | — | — |
| Usuarios y roles | ✔ | ✔ | — | — | — | — |
| **Eliminar tenant / transferir propiedad** | ✔ | — | — | — | — | — |
| Configuración | ✔ | ✔ | — | — | — | — |
| Audit log | ✔ | ✔ | R (90 días) | — | — | — |
| Reportes operativos | ✔ | ✔ | ✔ | ✔ | — | — |
| **Reportes financieros** | ✔ | ✔ | — | R (sin rentabilidad) | — | — |

R = read only. `own` = limitado a registros donde el usuario es el asignado.

### B.4 Reglas de permisos no negociables

1. **Nadie borra nada.** No existe `DELETE` de negocio. Todo es `archived_at` / `voided_at` / asiento de reversa. El único borrado físico es por pedido de eliminación de datos personales (§K.11).
2. **El Operario nunca ve dinero ajeno.** Ni caja de otro operario, ni precio de servicios que no ejecutó, ni márgenes.
3. **El Operario no puede editar un servicio cerrado.** Ni siquiera el suyo. Pide reapertura, un Admin la concede, queda auditado.
4. **Quien ejecuta no aprueba.** El operario rinde, el Admin/Supervisor aprueba. Nunca la misma persona en la misma transacción financiera.
5. **El Director Técnico es el único que firma.** Ni el Owner puede firmar un certificado si no tiene matrícula cargada y vigente.
6. **Escalada de permisos imposible.** Un rol no puede asignar un permiso que él mismo no tiene.

### B.5 Caso borde importante: el Owner que también es Operario

Frecuentísimo en pymes: el dueño sale a fumigar. El modelo lo soporta porque los permisos son aditivos y el scope `own` no molesta al scope `tenant`. Pero se rompe la regla #4. **Decisión:** si un usuario tiene ambos permisos (`cash.close.own` y `cash.approve_closure`), la autoaprobación se permite pero se marca `self_approved = true` y se resalta en rojo en el reporte de auditoría. No se bloquea: bloquearlo haría inusable el sistema en una empresa de 3 personas.

---
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
## D. ESTADOS DEL SISTEMA

### D.1 Por qué tu máquina de estados no funciona

Tu lista era:

```
DRAFT → SCHEDULED → ASSIGNED → PUBLISHED → EN_ROUTE → ARRIVED
→ IN_PROGRESS → PENDING_CLOSURE → COMPLETED / CANCELLED / NO_SHOW
```

Cuatro problemas concretos:

1. **`PUBLISHED` no es un estado del servicio.** Publicar es una acción sobre la *ruta*. Si una ruta tiene 8 servicios y despublicás, tenés que revertir 8 estados a mano y no sabés a cuál volver.
2. **`EN_ROUTE` / `ARRIVED` no son del servicio, son del intento de visita.** Si el operario va, el cliente no está, y se reprograma para el jueves: ¿el servicio vuelve de `ARRIVED` a `SCHEDULED`? Perdés el registro de que hubo un viaje fallido, que tiene costo real y que a veces se cobra.
3. **`NO_SHOW` como estado terminal del servicio es incorrecto.** Cliente ausente no cierra el servicio, lo *reprograma*. `NO_SHOW` es el **resultado de una visita**, no el final de un trabajo.
4. **Falta la validación administrativa.** `PENDING_CLOSURE` está pero no está claro quién la saca. Y falta un estado para "el operario dice que terminó pero el admin todavía no lo revisó", que es donde se detectan las fotos faltantes.

### D.2 Modelo corregido: tres ciclos de vida

```
SERVICE ──────► el trabajo comercial. Vive hasta que se completa o se cancela.
   │              Puede requerir varias visitas.
   ├─► ROUTE_STOP ──► un intento de visita planificado, en una ruta, un día.
   │                   Puede terminar en éxito o en fracaso (ausente, inaccesible).
   └─► SERVICE_SESSION ──► el registro cronometrado de una ejecución efectiva.
                            Solo existe si el operario efectivamente empezó a trabajar.
```

Relación: `service 1..N route_stop`, `route_stop 0..1 service_session`.

### D.3 Máquina de estados: SERVICE

| Estado | Significado |
|---|---|
| `DRAFT` | Cargado incompleto. No entra al planificador. |
| `SCHEDULED` | Tiene fecha objetivo, sin operario. Aparece en el panel "sin asignar". |
| `ASSIGNED` | Está dentro de un `route_stop` de una ruta en `DRAFT`/`READY`. |
| `DISPATCHED` | Su ruta fue publicada. El operario ya lo ve. *(Reemplaza tu `PUBLISHED`.)* |
| `IN_EXECUTION` | Hay una sesión abierta. |
| `PENDING_VALIDATION` | El operario cerró. Falta revisión administrativa. *(Reemplaza `PENDING_CLOSURE`.)* |
| `COMPLETED` | Validado. Habilita certificado. **Inmutable.** |
| `PARTIALLY_COMPLETED` | Se hizo parte, requiere revisita. Genera servicio hijo automáticamente. |
| `RESCHEDULED` | Estado transitorio: hubo un intento fallido, vuelve a `SCHEDULED` con nueva fecha. |
| `CANCELLED` | Terminal. Con motivo obligatorio y flag `billable` (cancelación tardía a veces se cobra). |

Transiciones:

```
DRAFT ──────────► SCHEDULED ──────► ASSIGNED ──────► DISPATCHED ──────► IN_EXECUTION
  │                   ▲   ▲             │  ▲              │  │                 │
  │                   │   └─────────────┘  └──────────────┘  │                 │
  │                   │      (desasignar)   (despublicar)    │                 │
  │                   │                                       │                 ▼
  │                   └───────────────────────────────────────┘        PENDING_VALIDATION
  │                            (RESCHEDULED: ausente / inaccesible)      │      │
  │                                                                      │      │
  └──────────► CANCELLED ◄─────────(desde cualquier estado no terminal)  │      │
                                                                          ▼      ▼
                                                    PARTIALLY_COMPLETED  COMPLETED
                                                              │              ▲
                                                              └──► (genera servicio hijo)
                                                                             │
                                                            (rechazo: vuelve a IN_EXECUTION)
```

**Quién puede ejecutar cada transición:**

| Transición | Quién | Condiciones |
|---|---|---|
| `DRAFT → SCHEDULED` | `service.update` | Tiene cliente, ubicación, tipo, fecha objetivo y precio. |
| `SCHEDULED → ASSIGNED` | `route.update` | Se creó un `route_stop`. Operario con libreta vigente. |
| `ASSIGNED → SCHEDULED` | `route.update` | Ruta no publicada. |
| `ASSIGNED → DISPATCHED` | `route.publish` | Automático al publicar la ruta. Nunca manual. |
| `DISPATCHED → ASSIGNED` | `route.unpublish` | Solo si ningún stop de la ruta tiene sesión abierta o cerrada. |
| `DISPATCHED → IN_EXECUTION` | `session.start` (Operario asignado) | Ruta en `IN_PROGRESS`, no hay otra sesión abierta del mismo operario. |
| `IN_EXECUTION → PENDING_VALIDATION` | `session.finish` (Operario) | Checklist de cierre completo (§I.R4). |
| `PENDING_VALIDATION → COMPLETED` | `service.validate` | Evidencia mínima OK. |
| `PENDING_VALIDATION → IN_EXECUTION` | `service.reject` | Motivo obligatorio. Notifica al operario. Reabre la sesión. |
| `* → RESCHEDULED → SCHEDULED` | `service.reschedule` | Automático si el stop cerró en `NO_SHOW`/`INACCESSIBLE`; el admin fija nueva fecha. |
| `* → CANCELLED` | `service.cancel` | Motivo obligatorio de una lista cerrada. Si estaba en ruta publicada, notifica al operario. |
| `COMPLETED → IN_EXECUTION` | `session.reopen` (solo Admin/Owner) | Ventana de 7 días. Motivo obligatorio. **Anula el certificado si ya fue emitido.** Audit crítico. |

### D.4 Máquina de estados: ROUTE

| Estado | Significado |
|---|---|
| `DRAFT` | En armado. El operario no la ve. Editable libremente. |
| `READY` | Validada, lista para publicar. Editable. *(Estado opcional pero útil: permite armar el jueves la ruta del viernes y que un Supervisor la revise.)* |
| `PUBLISHED` | Visible para el operario. **Edición restringida** (§I.R13). |
| `IN_PROGRESS` | El operario inició la jornada o el primer stop. |
| `COMPLETED` | Todos los stops en estado terminal + operario cerró jornada. |
| `CANCELLED` | Terminal. Todos los stops vuelven a `SCHEDULED`. |

```
DRAFT ⇄ READY ──► PUBLISHED ──► IN_PROGRESS ──► COMPLETED
  │        │          │              │
  └────────┴──────────┴──────────────┴──────► CANCELLED
                      └──► DRAFT (unpublish, solo si ningún stop arrancó)
```

**`READY` merece existir** porque separa "estoy armando" de "está lista pero todavía no la quiero mostrar". Sin ese estado, o el operario ve rutas a medio armar, o el admin publica a las 7 de la mañana corriendo.

### D.5 Máquina de estados: ROUTE_STOP

Este es el que faltaba por completo en tu planteo.

| Estado | Significado |
|---|---|
| `PENDING` | Planificado, sin acción. |
| `EN_ROUTE` | El operario apretó "voy en camino". Registra hora y coordenada de salida. |
| `ARRIVED` | Llegó. Registra hora, coordenada y `accuracy`. |
| `IN_PROGRESS` | Sesión abierta. |
| `DONE` | Ejecutado y cerrado por el operario. |
| `NO_SHOW` | Cliente ausente. **Requiere evidencia**: foto de la fachada + hora + coordenada. |
| `INACCESSIBLE` | Llegó pero no pudo trabajar (obra, local cerrado, mascota suelta, sin agua). Motivo de lista cerrada + foto. |
| `SKIPPED` | Salteado por decisión operativa (se hizo tarde, se fue la luz). Motivo obligatorio. |
| `CANCELLED` | El servicio se canceló mientras la ruta estaba activa. |

```
PENDING ──► EN_ROUTE ──► ARRIVED ──► IN_PROGRESS ──► DONE
   │            │            │                          
   │            │            ├──► NO_SHOW ──────┐       
   │            │            └──► INACCESSIBLE ─┤       
   ├────────────┴──► SKIPPED ────────────────────┤      
   └──► CANCELLED                                 │      
                                                  ▼      
                                    dispara service → RESCHEDULED
```

**`EN_ROUTE` es opcional.** El operario puede ir directo de `PENDING` a `ARRIVED` (se olvidó de apretar el botón). El sistema no debe obligarlo: cada botón obligatorio en campo es un servicio que no se registra. Se registra el salto y listo.

### D.6 Estados de SERVICE_SESSION

`OPEN` → `CLOSED` → (`REOPENED` → `CLOSED`). Con `started_at`, `ended_at`, `paused_intervals[]` (el operario para a almorzar en medio de un trabajo de 4 horas — sin pausas, el tiempo efectivo es basura).

### D.7 Estados de dinero

- `payment`: `CONFIRMED` | `VOIDED` (nunca `PENDING` en el MVP: se registra lo que ya se cobró).
- `cash_closure`: `OPEN` → `DECLARED` (el operario contó) → `RECONCILED` (el admin recibió y aceptó) | `DISPUTED` (hay diferencia sin resolver).
- `certificate`: `DRAFT` → `ISSUED` → `SIGNED` → `VOIDED`.

### D.8 Regla transversal de implementación

**Toda transición de estado se hace en el backend, dentro de una transacción, con validación previa contra una tabla de transiciones permitidas.** Nunca `service.status = 'COMPLETED'` desde un controller. Un único `StateMachineService` genérico:

```ts
await stateMachine.transition({
  entity: 'service', id, from: expectedCurrentStatus, to: 'COMPLETED',
  actor: user, reason?, guards: [...]
})
```

Si `from` no coincide con el estado actual en la DB (`SELECT ... FOR UPDATE`), falla con `409 CONFLICT`. Esto resuelve el 90% de los problemas de concurrencia (§I.R20).

---
## E. FLUJO DEL ADMINISTRADOR

### E.1 Camino feliz

1. **Login.** Email + password. Sesión larga en desktop (7 días con refresh rotativo).
2. **Dashboard.** Lo primero que ve: alertas accionables. "3 rendiciones sin aprobar", "2 servicios rechazados", "stock de Cipermetrina bajo mínimo", "libreta de Juan vence en 12 días".
3. **Entrada del trabajo.** Tres orígenes:
   - Manual: el teléfono suena. Alta de cliente + ubicación + servicio en una sola pantalla, sin salir.
   - Automático: el generador de contratos creó los servicios del mes.
   - Revisita de garantía: desde un servicio `COMPLETED`, botón "generar revisita", precio 0, `is_warranty_visit = true`.
4. **Planificación.** Vista semana. Los servicios `SCHEDULED` aparecen en el panel izquierdo agrupados por zona. Se filtran por fecha objetivo.
5. **Asignación.** Drag del servicio a la columna del operario y día. Se crea `route` en `DRAFT` si no existía, y un `route_stop`. Advertencias en vivo, no bloqueos (excepto libreta vencida).
6. **Armado y orden.** Reordenar stops. Definir hora estimada de cada uno. Botón "optimizar orden" en Fase 2; en MVP, orden manual con ayuda visual de mapa.
7. **Validación pre-publicación.** El botón "Publicar" corre los guards de §W.2 y muestra el resultado antes de confirmar. Si falta stock del químico requerido para los servicios de la ruta, advierte con el faltante calculado.
8. **Publicación.** Modal de confirmación con resumen: "Ruta de Juan, viernes 22/08, 7 servicios, 09:00–17:30". Confirmar → transacción atómica → push al operario.
9. **Monitoreo.** Vista "Hoy" con una fila por operario y un chip por stop, coloreado por estado. Actualización por polling cada 60s en MVP (no WebSockets, §R.4). Se ve el atraso acumulado.
10. **Cierres.** Cola de `PENDING_VALIDATION`. El admin abre, ve fotos, firma, insumos, pago, y aprueba o rechaza con motivo.
11. **Certificados.** Cola de servicios `COMPLETED` sin certificado. Emisión individual o en lote. El DT firma en lote.
12. **Rendición.** El operario declaró $148.000. El admin cuenta, confirma o registra diferencia.
13. **Reportes.** Cierre de semana/mes.

### E.2 Casos excepcionales (todos deben estar implementados)

| Situación | Comportamiento requerido |
|---|---|
| Cliente cancela una hora antes, ruta publicada e iniciada | Admin cancela el servicio → `route_stop` a `CANCELLED` → **push inmediato al operario** + banner rojo en su app. Si el operario ya está `EN_ROUTE`, se registra `wasted_trip = true` para reporte de costos. |
| Cliente pide cambio de horario el mismo día | Admin reordena los stops de una ruta publicada. Permitido con `route.update` + audit. El operario recibe push "tu ruta cambió" y la app refresca. **Nunca se reordena silenciosamente.** |
| Se enferma un operario a la mañana | Función "reasignar ruta completa": mueve todos los stops `PENDING` a otro operario. Los ya ejecutados quedan con el operario original. Genera dos rutas históricas coherentes. |
| Entra una urgencia con la ruta publicada | "Insertar stop": agrega a ruta publicada, requiere `route.update`, notifica. Se inserta en la posición elegida y recalcula las horas estimadas hacia abajo. |
| El operario cierra mal (fotos borrosas, insumo sin cargar) | Rechazo con motivo → vuelve a `IN_EXECUTION` → el operario ve la tarea en rojo en su app con el comentario. |
| Servicio completado hace 3 días con dato mal cargado | Reapertura por Admin, ventana de 7 días, motivo obligatorio, **anula certificado emitido**, audit crítico. Después de 7 días: no se reabre, se emite nota de corrección. |
| Un pago se cargó dos veces | No se edita: se anula por reversa (`payment.void`), que genera un `cash_movement` contrario. Ambos quedan visibles. |
| Falta stock para publicar | Advertencia con faltante exacto y botón directo a "transferir del depósito". |
| Dos admins editan la misma ruta a la vez | Bloqueo optimista por `version`. El segundo recibe `409` con "Esta ruta fue modificada por Ana hace 30 segundos. Recargar." |

---

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
## G. UX / UI

### G.1 Sistema de diseño

Dirección estética: **utilitario premium**. Referencia mental: Linear para el admin, Google Maps para el operario. Nada decorativo. El producto se usa 8 horas por día por gente apurada.

**Tokens** (fuente única: `packages/ui/tokens.css`, consumidos por Tailwind):

```css
/* Neutros — nunca negro puro ni blanco puro */
--bg:            #FAFAF9;   --bg-elevated:  #FFFFFF;
--border:        #E7E5E4;   --border-strong:#D6D3D1;
--fg:            #1C1917;   --fg-muted:     #57534E;  --fg-subtle: #A8A29E;

/* Primario — verde técnico, no "verde ecológico" */
--primary:       #15803D;   --primary-hover:#166534;  --primary-fg: #FFFFFF;
--primary-subtle:#F0FDF4;

/* Semánticos de estado (usados en chips de servicio/stop) */
--state-draft:   #A8A29E;   --state-scheduled: #0369A1;  --state-dispatched: #7C3AED;
--state-progress:#EA580C;   --state-done:      #15803D;  --state-problem:    #DC2626;
--state-pending: #CA8A04;

/* Radios / sombras / transiciones */
--radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 14px;  --radius-full: 9999px;
--shadow-sm: 0 1px 3px rgba(28,25,23,.08), 0 1px 2px rgba(28,25,23,.04);
--shadow-md: 0 4px 16px rgba(28,25,23,.08), 0 2px 4px rgba(28,25,23,.04);
--transition: 150ms cubic-bezier(.4,0,.2,1);
```

**Tipografía:** Inter (`next/font`, self-hosted, sin llamada externa — el operario puede estar en 3G). Escala: `display 30/36` · `h1 24/32` · `h2 20/28` · `h3 16/24` · `body 15/22` · `caption 13/18` · `mono 13` (para montos y códigos, tabular-nums obligatorio).

**Espaciado:** escala de 4px (4, 8, 12, 16, 24, 32, 48, 64).

**Breakpoints:** 375 / 640 / 1024 / 1440. Admin optimizado a 1440. Campo optimizado a 375–412.

**Reglas específicas de la app de campo, no negociables:**
- Touch target mínimo **56×56 px** (no 44 — el operario usa guantes).
- Botón de acción principal: ancho completo, 64 px de alto, fijo abajo, siempre visible.
- Contraste mínimo **7:1** en texto principal (AAA), porque se usa bajo sol directo.
- Cero hover como único indicador de estado.
- Modo alto contraste opcional en configuración.
- **Sin animaciones de más de 200 ms** y respeto a `prefers-reduced-motion`.

### G.2 Pantallas — ADMIN DESKTOP

Formato: Objetivo · Componentes · Datos · Acciones · Empty · Loading · Error · Confirmación · Permiso.

---

**AD-01 · Login**
Objetivo: entrar rápido. · Card centrada, logo, email, password, "recordarme", link recupero. · — · Entrar. · — · Botón con spinner, campos deshabilitados. · Mensaje genérico "Email o contraseña incorrectos" (nunca revelar cuál). Tras 5 intentos, captcha. · — · Público.

**AD-02 · Dashboard**
Objetivo: saber qué requiere atención hoy. · Fila de 4 KPI cards + panel de alertas accionables + tabla "servicios de hoy" + mini-timeline de operarios. · Servicios hoy por estado, cobrado hoy (efectivo/transferencia separados), pendiente de rendición, alertas. · Click en KPI → lista filtrada. Click en alerta → acción directa. · "Todavía no hay servicios cargados" + CTA "Crear el primero". · Skeletons por card, nunca spinner de página completa. · Card individual muestra "no se pudo cargar" + reintentar, sin tumbar el dashboard. · — · Todos los roles admin; el Operario no accede.

**AD-03 · Clientes (lista)**
Objetivo: encontrar un cliente en menos de 3 segundos. · Búsqueda con debounce 300 ms (nombre, CUIT, teléfono, dirección), tabla virtualizada, filtros por tipo/tag/estado, paginación server-side. · Nombre, tipo, ubicaciones, último servicio, próximo servicio, deuda. · Nuevo, ver, editar, archivar. · Ilustración + "Crear cliente". · Skeleton de 10 filas. · Banner de error con reintentar; la búsqueda previa queda visible. · Archivar pide confirmación y explica que no se borra. · `customer.read`.

**AD-04 · Cliente (detalle)**
Objetivo: contexto completo. · Header con datos + tabs: Ubicaciones · Servicios · Contratos · Pagos · Certificados · Notas. · Cuenta corriente, historial. · Nuevo servicio, nueva ubicación, nuevo contrato, registrar pago. · Por tab. · Tabs cargan lazy. · Por tab. · — · `customer.read`; acciones según permiso.

**AD-05 · Alta rápida de servicio** ← *pantalla más usada del sistema*
Objetivo: cargar un servicio mientras se habla por teléfono, sin salir de la pantalla. · Modal ancho de un paso. Combobox de cliente con creación inline. Selector de ubicación (o inline). Tipo de servicio, plagas (multi-chip), fecha objetivo (datepicker con atajos "hoy/mañana/esta semana"), ventana horaria, duración estimada (autocompletada por tipo), precio (autocompletado por lista vigente, editable solo con `service.price.override`), notas. · — · Guardar / Guardar y crear otro. · — · — · Errores de campo inline; el modal **nunca** se cierra perdiendo datos. Borrador en `sessionStorage`. · Sale sin guardar → confirmación. · `service.create`.

**AD-06 · Planificador** ← *pantalla técnicamente más compleja*
Objetivo: asignar el trabajo del día/semana. · Layout 2 columnas: panel izquierdo con servicios sin asignar (filtro por zona y fecha, chips arrastrables) + grilla central de operarios × horas. Toggle día/semana. Mapa colapsable a la derecha. · Duración, ventana horaria, conflictos. · Drag & drop, click para detalle, "crear ruta", "publicar". · "No hay servicios pendientes para esta semana". · Grilla con skeleton; los servicios se cargan aparte. · Si falla el guardado del drop, **el chip vuelve a su lugar con animación** y aparece un toast — nunca queda en un estado visual mentiroso. · Publicar → modal resumen. · `route.update`; publicar requiere `route.publish`.

Detalle técnico: drag con `@dnd-kit` (no react-beautiful-dnd, sin mantenimiento). Actualización optimista con rollback. Autosave por debounce de 800 ms.

**AD-07 · Ruta (detalle)**
Objetivo: revisar y publicar. · Lista ordenable de stops, mapa con numeración, panel de validación (checklist de guards en verde/rojo), resumen de insumos requeridos vs. stock del operario. · Horarios estimados, distancia total. · Reordenar, agregar/quitar stop, publicar, despublicar, cancelar, duplicar. · "Ruta vacía — arrastrá servicios". · Skeleton. · Conflicto de versión → modal "modificada por X, recargar". · Publicar y despublicar piden confirmación con consecuencias explicadas. · `route.read`.

**AD-08 · Hoy (monitoreo en vivo)**
Objetivo: ver el estado del día de un vistazo. · Una fila por operario, chips por stop coloreados, barra de progreso, indicador de atraso. Auto-refresh 60 s con indicador "actualizado hace X". · Hora real vs. estimada. · Click en chip → panel lateral con fotos y datos en vivo. · "No hay rutas publicadas para hoy". · Primera carga con skeleton; refrescos silenciosos. · Si falla el refresh, se mantiene el último dato bueno con aviso "datos de hace 3 min". · — · `route.read.tenant`.

**AD-09 · Validación de cierres**
Objetivo: aprobar o rechazar rápido, en lote. · Cola tipo bandeja. Panel derecho con visor de fotos (grande), datos de la sesión, insumos, pago, firma. Atajos de teclado: `A` aprobar, `R` rechazar, `→` siguiente. · Duración, distancia GPS a la ubicación, variación de precio. · Aprobar, rechazar con motivo, aprobar todos los que cumplen. · "Nada pendiente de validar". · — · — · Rechazo exige motivo. · `service.validate`.

**AD-10 · Certificados**
Objetivo: emitir y firmar sin fricción. · Lista de `COMPLETED` sin certificado + lista de emitidos. Preview del PDF en panel. Selección múltiple. · Número correlativo, DT asignado. · Emitir, emitir en lote, firmar (DT), descargar, enviar por email, copiar link WhatsApp, anular. · "No hay certificados pendientes". · Generación en background con toast de progreso. · Si falla la generación, queda en cola con reintento. · Anular exige motivo y advierte que es irreversible. · `certificate.issue` / `certificate.sign`.

**AD-11 · Inventario**
Objetivo: saber qué hay y dónde. · Tabla producto × ubicación de stock. Filtro por ubicación. Alertas de mínimo y de vencimiento. · Stock por lote con vencimiento. · Transferir, ajustar, reponer, ver movimientos. · — · — · — · Ajuste exige motivo y muestra el delta antes de confirmar. · `inventory.read`.

**AD-12 · Caja y rendiciones**
Objetivo: cerrar la plata del día sin discusión. · Cajas abiertas por operario con esperado en vivo. Cola de rendiciones `DECLARED`. Detalle con lista de pagos que componen el esperado. · Esperado / declarado / diferencia. · Aprobar, registrar diferencia con motivo, ajustar. · — · — · — · Diferencia mayor a la tolerancia configurada exige aprobación de Admin+ y motivo escrito. · `cash.read.tenant`.

**AD-13 · Reportes** · §P. Filtros de fecha/operario/cliente/tipo, export CSV y XLSX (background si >5.000 filas).

**AD-14 · Configuración** · Secciones: Empresa · Directores Técnicos · Tipos de servicio · Zonas · Listas de precios · Usuarios y roles · Parámetros operativos · Plantilla de certificado.

**AD-15 · Auditoría** · Timeline filtrable por entidad/actor/fecha, con diff antes/después. Solo lectura, sin excepción.

### G.3 Pantallas — OPERARIO MOBILE (PWA)

**OP-01 · Login**
Objetivo: entrar con guantes. · Campo usuario + teclado numérico grande de 6 dígitos para el PIN. Botón "recordarme en este dispositivo" activado por defecto. · — · Entrar. · — · Botón en loading. · "Usuario o PIN incorrecto". Sin conexión: si hay sesión previa válida en el dispositivo, **entra igual en modo offline**. · — · Público.

**OP-02 · Mi ruta de hoy** ← *pantalla principal*
Objetivo: saber a dónde ir ahora. · Header sticky: fecha, progreso "3 de 7", cobrado hoy, chip de sincronización. Lista de tarjetas de stop; la actual expandida y destacada; las hechas colapsadas con check verde. Botón inferior fijo contextual. · Hora estimada, cliente, dirección corta, chip de estado, monto. · Tap → detalle. Botón principal cambia según contexto ("Voy en camino" / "Llegué" / "Iniciar"). · "No tenés ruta para hoy" + fecha del próximo servicio. · Skeleton de 3 tarjetas. · Si no hay red y no hay caché: "Sin conexión y sin datos guardados. Conectate una vez para descargar tu ruta." · — · Operario asignado.

**OP-03 · Detalle del stop**
Objetivo: todo lo necesario para trabajar, sin scroll infinito. · Bloques colapsables: Cliente y contacto (botón llamar y WhatsApp) · Dirección + 2 botones de navegación · Cómo entrar / advertencias (perro, portero) en destaque amarillo · Servicio y plagas · Notas del admin · Historial (2 últimos) · Cobro esperado. · — · Llamar, navegar, llegué, iniciar. · — · — · — · — · Operario asignado.

**OP-04 · Ejecución**
Objetivo: registrar el trabajo sin pensar. · Cronómetro visible arriba. Secciones en acordeón con check de completitud: Fotos antes · Observaciones · Insumos · Fotos después · Pago · Firma. Botón inferior "Cerrar servicio" habilitado solo cuando el checklist cumple; si no, al tocarlo dice exactamente qué falta. · Tiempo transcurrido. · Cámara, seleccionar insumo, registrar pago, firmar, pausar. · — · — · Todo se guarda local; error de red no interrumpe. · Cerrar → hoja de resumen con confirmación. · `session.*`.

**OP-05 · Cámara / evidencia**
Objetivo: fotos útiles, livianas. · Cámara nativa vía `<input capture>` (no getUserMedia: mejor calidad y menos bugs en Android viejo). Grid de miniaturas con estado de subida por foto. Selector de categoría con chips grandes. · — · Sacar, categorizar, eliminar (solo si aún no se subió), reintentar. · "Sin fotos todavía". · Barra de progreso por foto. · Foto fallida se marca en rojo con botón reintentar; **nunca se pierde**. · Eliminar pide confirmación. · `evidence.upload`.

Técnico: compresión a WebP ~1600 px lado mayor, calidad 0.75, target <300 KB. EXIF de GPS strippeado. Blob en IndexedDB hasta confirmar subida.

**OP-06 · Insumos**
Objetivo: cargar consumo en 3 taps. · Lista de productos disponibles en *su* stock, con lo más usado arriba. Al elegir: lote (auto si es único), stepper de cantidad con unidades grandes, y cálculo automático concentrado↔mezcla. · Stock disponible visible. · Agregar, editar, quitar, "no tenía stock". · "Sin insumos cargados". · — · Si el stock quedaría negativo: advertencia clara, permite continuar (el consumo real es el que vale) y marca el movimiento para ajuste. · — · Operario asignado.

**OP-07 · Pago**
Objetivo: no equivocarse con la plata. · Monto esperado grande y precargado. Tres botones enormes de método. Si transferencia → cámara obligatoria. Si el monto se edita → motivo obligatorio. · Efectivo acumulado del día. · Registrar. · — · — · — · Confirmación con el monto en grande antes de guardar. · `payment.create`.

**OP-08 · Firma**
Objetivo: conformidad del cliente. · Canvas a pantalla completa en horizontal, botón limpiar, campo nombre y aclaración/DNI. Opción "el cliente no puede firmar" + motivo. · — · Guardar, limpiar, omitir con motivo. · — · — · — · — · Operario asignado.

**OP-09 · Cierre de jornada y rendición**
Objetivo: rendir sin discusión. · Resumen del día: servicios, tiempo, efectivo esperado desglosado por servicio. Campo "efectivo que entrego". Si difiere → motivo obligatorio. · — · Rendir. · — · — · Se encola offline. · Confirmación con el monto en grande. · `cash.close.own`.

**OP-10 · Estado de sincronización**
Objetivo: confianza. Accesible desde el chip del header. · Lista de acciones pendientes con su estado (pendiente / enviando / error), botón "reintentar todo", último sync exitoso. · — · Reintentar. · "Todo sincronizado" con check verde. · — · Errores con explicación legible y opción de reintento. · — · Operario.

### G.4 Mejoras premium sugeridas

**UX de alta prioridad:**
1. **Ruta del día precargada la noche anterior.** Cuando el admin publica, se dispara push; el service worker descarga todo (datos + historial + fotos previas) mientras el celular está en wifi en la casa del operario. A la mañana, la app abre instantánea y con datos aunque salga sin señal.
2. **Checklist por tipo de servicio, configurable.** Desratización pide cosas distintas que desinfección. Cargar el checklist desde la config del tenant convierte el producto en configurable sin tocar código, y es la base de la venta a otras empresas.
3. **"Modo apuro" en el planificador.** Un botón que autoasigna los servicios sin asignar al operario más cercano con hueco. No es optimización de rutas: es una heurística simple que resuelve el 80% de los días normales.

**Visuales:**
4. Color por operario, consistente en todo el sistema (chip, avatar, columna del planificador, línea del mapa). Reconocimiento sin leer.
5. Chips de estado con forma además de color (punto / anillo / check), para daltonismo y para el sol.

**Interacción que sorprende:**
6. **Deslizar el stop hacia la derecha = "Llegué".** Gesto de una mano, con el celular en la misma mano que sostiene la mochila. Con feedback háptico. Es el tipo de detalle que hace que el operario prefiera la app al cuaderno.

---
## H. MODELO DE DATOS (PostgreSQL)

### H.1 Convenciones obligatorias

| Regla | Detalle |
|---|---|
| Nombres | `snake_case`, tablas en plural. |
| PK | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. Excepción: tablas de log usan `BIGSERIAL` (mejor localidad de índice en append masivo). |
| Tenant | **Toda** tabla de negocio lleva `tenant_id UUID NOT NULL REFERENCES tenants(id)`. Sin excepción. |
| Timestamps | `created_at`, `updated_at` `TIMESTAMPTZ NOT NULL DEFAULT now()`. **Siempre TIMESTAMPTZ**, jamás `TIMESTAMP`. |
| Soft delete | `archived_at TIMESTAMPTZ NULL`. No hay `DELETE` de negocio. |
| Auditoría de fila | `created_by`, `updated_by` `UUID REFERENCES users(id)`. |
| Concurrencia | `version INTEGER NOT NULL DEFAULT 1` en entidades editables por varios actores (`services`, `routes`, `route_stops`). |
| Dinero | `BIGINT` en **centavos**, más `currency CHAR(3) NOT NULL DEFAULT 'ARS'`. **Nunca `FLOAT`, nunca `NUMERIC` para montos operativos.** |
| Cantidades físicas | `NUMERIC(12,4)` (mililitros y gramos necesitan decimales). |
| Estados | `ENUM` de Postgres, no `VARCHAR` libre. |
| Índices | Todo FK tiene índice. Todo índice de tabla multi-tenant empieza por `tenant_id`. |
| Unicidad | Toda constraint de unicidad de negocio incluye `tenant_id`. |
| Geo | `lat NUMERIC(10,7)`, `lng NUMERIC(10,7)`. **No PostGIS en el MVP** (§R.3). |

### H.2 Tablas

#### `tenants`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(150) NOT NULL | |
| slug | VARCHAR(60) NOT NULL UNIQUE | subdominio futuro |
| legal_name, tax_id | VARCHAR | razón social, CUIT |
| health_authorization_number | VARCHAR(60) | **habilitación como empresa de control de plagas** |
| logo_url, address, phone, email | VARCHAR | |
| timezone | VARCHAR(40) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires' | |
| plan | tenant_plan NOT NULL DEFAULT 'CORE' | |
| status | tenant_status NOT NULL DEFAULT 'ACTIVE' | ACTIVE / SUSPENDED / TRIAL |
| settings | JSONB NOT NULL DEFAULT '{}' | parámetros operativos |

#### `users`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | **igual al `auth.users.id` de Supabase** |
| email | CITEXT NOT NULL UNIQUE | puede ser sintético para operarios |
| username | VARCHAR(40) | login corto de operarios |
| full_name, phone, avatar_url | | |
| color | CHAR(7) | identificación visual |
| is_active | BOOLEAN NOT NULL DEFAULT true | |
| last_login_at | TIMESTAMPTZ | |

`users` **no** lleva `tenant_id`: la relación va por `memberships` (un usuario puede estar en varios tenants).
Índices: `UNIQUE(email)`, `UNIQUE(username) WHERE username IS NOT NULL`.

#### `memberships`
`id`, `tenant_id` FK, `user_id` FK, `role_id` FK, `status` (ACTIVE/SUSPENDED), `joined_at`.
`UNIQUE(tenant_id, user_id)`. Índices en ambos FK.

#### `roles`
`id`, `tenant_id` FK, `key` VARCHAR(40), `name`, `is_system` BOOLEAN, `description`.
`UNIQUE(tenant_id, key)`. Roles semilla: `owner`, `admin`, `supervisor`, `office`, `technician`, `technical_director`.

#### `permissions`
`key VARCHAR(60) PRIMARY KEY`, `resource`, `action`, `description`. **Tabla global, sin `tenant_id`** (es catálogo, no dato de negocio).

#### `role_permissions`
`role_id` FK, `permission_key` FK, `scope` ENUM(`own`,`team`,`tenant`) DEFAULT `tenant`.
`PRIMARY KEY(role_id, permission_key)`.

#### `technician_profiles`
Extensión de `users` para operarios y DT.
`user_id` PK/FK, `tenant_id`, `license_number` (libreta sanitaria / matrícula), `license_type` ENUM(`SANITARY_BOOK`,`TECHNICAL_DIRECTOR`), `license_expires_at` DATE, `signature_url` (solo DT), `vehicle_id` FK, `stock_location_id` FK.
Índice: `(tenant_id, license_expires_at)` para la alerta de vencimiento.

#### `customers`
`id`, `tenant_id`, `type` ENUM(`INDIVIDUAL`,`COMPANY`), `legal_name`, `trade_name`, `tax_id`, `tax_condition` ENUM, `payment_terms` ENUM(`CASH`,`ACCOUNT`,`CONTRACT`), `credit_limit_cents`, `notes`, `tags TEXT[]`, `archived_at`.
Índices: `(tenant_id, archived_at)`, `(tenant_id, tax_id)`, y **búsqueda full-text**: `GIN (to_tsvector('spanish', coalesce(legal_name,'')||' '||coalesce(trade_name,'')))`.

#### `customer_contacts`
`id`, `tenant_id`, `customer_id` FK, `name`, `role` ENUM(`OWNER`,`ONSITE`,`BILLING`), `phone`, `email`, `is_primary`.

#### `service_locations`
| Campo | Tipo | Notas |
|---|---|---|
| id, tenant_id, customer_id | | |
| label | VARCHAR(80) | "Sucursal Centro" |
| address_line, city, province, postal_code | | |
| lat, lng | NUMERIC(10,7) | |
| geocode_status | ENUM(`PENDING`,`OK`,`MANUAL`,`FAILED`) | |
| access_notes | TEXT | cómo se entra |
| hazard_notes | TEXT | perro, químicos, altura |
| establishment_type | ENUM | HOME / GASTRO / FOOD_INDUSTRY / WAREHOUSE / SCHOOL / OFFICE / OTHER |
| area_sqm | NUMERIC(10,2) | |
| service_window_start / _end | TIME | ventana de atención |
| zone_id | FK `zones` | |
| archived_at | | |

Índices: `(tenant_id, customer_id)`, `(tenant_id, zone_id)`, `(tenant_id, lat, lng)`.

#### `service_types` (catálogo por tenant)
`id`, `tenant_id`, `key`, `name`, `default_duration_minutes`, `checklist JSONB`, `required_supply_ids UUID[]`, `certificate_template_key`.

#### `service_contracts`
`id`, `tenant_id`, `customer_id`, `service_type_id`, `recurrence` JSONB (`{freq:'MONTHLY', interval:1, byMonthDay:15}`), `starts_on` DATE, `ends_on` DATE NULL, `auto_renew` BOOLEAN, `price_cents`, `billing_mode` ENUM(`PER_VISIT`,`MONTHLY_FEE`), `status` ENUM(`ACTIVE`,`PAUSED`,`CANCELLED`), `generate_ahead_days` INT DEFAULT 30, `last_generated_until` DATE.
Tabla puente `contract_locations(contract_id, service_location_id)`.

#### `services`
| Campo | Tipo | Notas |
|---|---|---|
| id, tenant_id | | |
| code | VARCHAR(20) NOT NULL | correlativo legible: `SRV-2026-00412` |
| customer_id, service_location_id, service_type_id | FK | |
| contract_id | FK NULL | origen |
| parent_service_id | FK NULL | revisita / continuación |
| origin | ENUM(`MANUAL`,`CONTRACT`,`WARRANTY`,`RESCHEDULE`,`PARTIAL_FOLLOWUP`) | |
| status | `service_status` NOT NULL | §D.3 |
| target_pests | TEXT[] | |
| scheduled_date | DATE | |
| window_start / window_end | TIME | |
| estimated_duration_minutes | INT | |
| required_technicians | SMALLINT NOT NULL DEFAULT 1 | **cuadrillas** |
| price_cents, currency | | |
| price_list_id | FK | de qué lista salió |
| is_warranty_visit | BOOLEAN DEFAULT false | precio 0, no cuenta como ingreso |
| warranty_until | DATE NULL | garantía que otorga este servicio |
| priority | ENUM(`LOW`,`NORMAL`,`HIGH`,`URGENT`) | |
| notes_internal, notes_for_technician | TEXT | |
| cancellation_reason | ENUM NULL | |
| cancelled_billable | BOOLEAN | |
| version | INT | |
| created_by, updated_by, created_at, updated_at | | |

Índices: `(tenant_id, status, scheduled_date)` ← el índice más usado del sistema; `(tenant_id, customer_id)`; `(tenant_id, service_location_id)`; `(tenant_id, contract_id)`; `UNIQUE(tenant_id, code)`.
Constraint: `CHECK (price_cents >= 0)`; `CHECK (window_start < window_end)`.
Unicidad de generación: `UNIQUE(contract_id, scheduled_date) WHERE contract_id IS NOT NULL` — hace idempotente al generador.

#### `routes`
`id`, `tenant_id`, `code`, `technician_id` FK users, `vehicle_id` FK NULL, `route_date` DATE NOT NULL, `status` `route_status`, `published_at`, `published_by`, `started_at`, `completed_at`, `notes`, `version`.
`UNIQUE(tenant_id, technician_id, route_date) WHERE status <> 'CANCELLED'` ← **un operario, una ruta por día**. Evita el desastre de dos rutas paralelas.
Índices: `(tenant_id, route_date, status)`, `(tenant_id, technician_id, route_date)`.

#### `route_stops`
`id`, `tenant_id`, `route_id` FK, `service_id` FK, `sequence` SMALLINT NOT NULL, `status` `stop_status`, `eta` TIME, `travel_minutes` SMALLINT, `en_route_at`, `arrived_at`, `arrival_lat`, `arrival_lng`, `arrival_accuracy_m`, `gps_status` ENUM(`OK`,`DENIED`,`UNAVAILABLE`,`TIMEOUT`), `distance_from_location_m` INT, `outcome_reason` ENUM NULL, `wasted_trip` BOOLEAN, `version`.
`UNIQUE(route_id, sequence) DEFERRABLE INITIALLY DEFERRED` ← **crítico**: sin `DEFERRABLE` no podés reordenar stops en una sola transacción.
`UNIQUE(service_id) WHERE status NOT IN ('CANCELLED','SKIPPED')` ← un servicio no puede estar activo en dos rutas.
Índices: `(tenant_id, route_id, sequence)`, `(tenant_id, status)`.

#### `service_sessions`
`id`, `tenant_id`, `service_id` FK, `route_stop_id` FK, `technician_id` FK, `status` ENUM(`OPEN`,`CLOSED`), `started_at`, `ended_at`, `start_lat/lng/accuracy_m`, `end_lat/lng/accuracy_m`, `paused_intervals` JSONB, `effective_minutes` INT GENERATED, `closure_checklist` JSONB, `client_signature_url`, `signer_name`, `signer_id_number`, `no_signature_reason` ENUM NULL, `technician_notes` TEXT, `reopened_count` SMALLINT DEFAULT 0, `client_event_id` UUID.
`UNIQUE(technician_id) WHERE status = 'OPEN'` ← **una sola sesión abierta por operario, garantizado por la DB**.
`UNIQUE(tenant_id, client_event_id)` ← idempotencia de sincronización offline.
Índices: `(tenant_id, service_id)`, `(tenant_id, technician_id, started_at)`.

#### `service_evidence`
`id`, `tenant_id`, `service_session_id` FK, `type` ENUM(`PHOTO`,`SIGNATURE`,`DOCUMENT`), `category` ENUM(`BEFORE`,`DURING`,`AFTER`,`FACADE`,`RECEIPT`,`ISSUE`), `storage_path` TEXT NOT NULL, `mime_type`, `size_bytes`, `width`, `height`, `sha256` CHAR(64), `taken_at` (device), `uploaded_at` (server), `lat`, `lng`, `accuracy_m`, `client_event_id` UUID.
`UNIQUE(tenant_id, client_event_id)`. Índice `(tenant_id, service_session_id)`.
Constraint: `CHECK (size_bytes <= 8388608)`.

#### `supplies` (catálogo de insumos)
`id`, `tenant_id`, `sku`, `name`, `category` ENUM(`INSECTICIDE`,`RODENTICIDE`,`DISINFECTANT`,`BAIT`,`TRAP`,`PPE`,`OTHER`), `active_ingredient`, `concentration`, **`registry_authority` ENUM(`ANMAT`,`SENASA`,`OTHER`)**, **`registry_number` VARCHAR(40)**, `purchase_unit` ENUM(`L`,`ML`,`KG`,`G`,`UNIT`), `application_unit`, `dilution_rate_ml_per_l` NUMERIC(8,3) NULL, `dose_per_sqm` NUMERIC(8,3) NULL, `reentry_hours` SMALLINT, `msds_url`, `unit_cost_cents`, `requires_lot_tracking` BOOLEAN DEFAULT true, `min_stock` NUMERIC(12,4), `archived_at`.
`UNIQUE(tenant_id, sku)`.

#### `stock_locations`
`id`, `tenant_id`, `type` ENUM(`WAREHOUSE`,`VEHICLE`), `name`, `technician_id` FK NULL, `vehicle_id` FK NULL, `is_active`.
`UNIQUE(tenant_id, technician_id) WHERE type='VEHICLE'`.

#### `supply_lots`
`id`, `tenant_id`, `supply_id` FK, `lot_code` VARCHAR(40), `expires_on` DATE, `received_at`, `unit_cost_cents`.
`UNIQUE(tenant_id, supply_id, lot_code)`. Índice `(tenant_id, expires_on)`.

#### `inventory` (saldo materializado)
`tenant_id`, `stock_location_id`, `supply_id`, `lot_id` NULL, `quantity` NUMERIC(12,4) NOT NULL DEFAULT 0, `updated_at`.
`PRIMARY KEY (stock_location_id, supply_id, lot_id)`.
**Es una proyección**: la verdad son los `inventory_movements`. Existe por performance y se actualiza en la misma transacción. Un job nocturno la reconcilia contra la suma de movimientos y alerta si difiere.

#### `inventory_movements` (append-only)
`id BIGSERIAL`, `tenant_id`, `stock_location_id`, `supply_id`, `lot_id`, `quantity_delta` NUMERIC(12,4) NOT NULL, `type` ENUM(`PURCHASE`,`TRANSFER_IN`,`TRANSFER_OUT`,`CONSUMPTION`,`RETURN`,`ADJUSTMENT`,`LOSS`,`EXPIRY_WRITE_OFF`), `reference_type`, `reference_id`, `reason`, `unit_cost_cents`, `performed_by`, `created_at`, `reversal_of_id` NULL.
**Sin `UPDATE` ni `DELETE`** — se revierte con un movimiento opuesto. Enforced por trigger.
Índices: `(tenant_id, supply_id, created_at)`, `(tenant_id, stock_location_id, created_at)`, `(reference_type, reference_id)`.

#### `service_supply_usage`
`id`, `tenant_id`, `service_session_id` FK, `supply_id` FK, `lot_id` FK NULL, `quantity_applied` NUMERIC(12,4), `unit`, `is_diluted_mix` BOOLEAN, `concentrate_equivalent` NUMERIC(12,4) ← **lo que realmente se descuenta del stock**, `application_method` ENUM(`SPRAY`,`GEL`,`BAIT_STATION`,`FOG`,`DUST`,`GRANULE`), `treated_area_sqm`, `inventory_movement_id` FK, `client_event_id` UUID.
`UNIQUE(tenant_id, client_event_id)`.

#### `payments`
`id`, `tenant_id`, `service_id` FK NULL, `customer_id` FK, `amount_cents` BIGINT NOT NULL, `currency`, `method` ENUM(`CASH`,`TRANSFER`,`MERCADOPAGO`,`CARD`,`CHECK`,`ACCOUNT`), `status` ENUM(`CONFIRMED`,`VOIDED`), `paid_at`, `received_by` FK users, `receipt_url`, `variance_reason` ENUM NULL, `reversal_of_id` FK NULL, `void_reason`, `client_event_id` UUID.
`UNIQUE(tenant_id, client_event_id)`.
`CHECK (amount_cents <> 0)`.
Índices: `(tenant_id, paid_at)`, `(tenant_id, service_id)`, `(tenant_id, received_by, paid_at)`, `(tenant_id, method, paid_at)`.

#### `cash_accounts`
`id`, `tenant_id`, `owner_user_id` FK, `type` ENUM(`TECHNICIAN`,`OFFICE`), `currency`, `is_active`.
`UNIQUE(tenant_id, owner_user_id, currency)`.

#### `cash_movements` (append-only)
`id BIGSERIAL`, `tenant_id`, `cash_account_id` FK, `amount_cents` BIGINT NOT NULL (signo: + ingreso, − egreso), `type` ENUM(`SERVICE_PAYMENT`,`EXPENSE`,`HANDOVER`,`ADJUSTMENT`,`OPENING_BALANCE`,`REVERSAL`), `reference_type`, `reference_id`, `closure_id` FK NULL, `description`, `performed_by`, `created_at`, `reversal_of_id`.
Sin `UPDATE`/`DELETE`, enforced por trigger.
Índices: `(tenant_id, cash_account_id, created_at)`, `(closure_id)`.

#### `cash_closures`
`id`, `tenant_id`, `cash_account_id` FK, `period_start`, `period_end`, `expected_cents` (calculado), `declared_cents` (operario), `received_cents` (admin), `difference_cents` GENERATED (`received - expected`), `status` ENUM(`OPEN`,`DECLARED`,`RECONCILED`,`DISPUTED`), `difference_reason`, `declared_by`, `declared_at`, `approved_by`, `approved_at`, `self_approved` BOOLEAN.
`UNIQUE(cash_account_id) WHERE status IN ('OPEN','DECLARED')` ← una sola rendición abierta por caja.

#### `certificates`
`id`, `tenant_id`, `number` INT NOT NULL, `formatted_number` VARCHAR(30) (`CERT-2026-00187`), `service_id` FK, `service_session_id` FK, `customer_id`, `service_location_id`, `technical_director_id` FK, `technician_id` FK, `status` ENUM(`DRAFT`,`ISSUED`,`SIGNED`,`VOIDED`), `snapshot` JSONB NOT NULL ← **congela todos los datos al emitir**, `pdf_storage_path`, `verification_token` UUID (para el QR público), `issued_at`, `signed_at`, `voided_at`, `void_reason`, `replaces_certificate_id` FK NULL.
`UNIQUE(tenant_id, number)`. Numeración correlativa por `SELECT ... FOR UPDATE` sobre un contador del tenant, no `MAX(number)+1`.

#### `price_lists` / `price_list_items`
`price_lists`: `id`, `tenant_id`, `name`, `valid_from` DATE, `valid_to` DATE NULL, `is_default`.
`price_list_items`: `price_list_id`, `service_type_id`, `establishment_type` NULL, `price_cents`, `price_per_sqm_cents` NULL.
Constraint de no solapamiento de vigencias con `EXCLUDE USING gist (tenant_id WITH =, daterange(valid_from, valid_to) WITH &&)`.

#### `notifications`
`id`, `tenant_id`, `user_id` FK, `type`, `title`, `body`, `payload` JSONB, `read_at`, `sent_channels` TEXT[], `created_at`.
Índice `(tenant_id, user_id, read_at)`.

#### `push_subscriptions`
`id`, `tenant_id`, `user_id`, `endpoint` TEXT UNIQUE, `p256dh`, `auth`, `user_agent`, `last_seen_at`.

#### `audit_logs` (append-only, particionable)
`id BIGSERIAL`, `tenant_id`, `actor_user_id`, `actor_role`, `action` VARCHAR(60), `entity_type`, `entity_id`, `before` JSONB, `after` JSONB, `diff` JSONB, `severity` ENUM(`INFO`,`WARNING`,`CRITICAL`), `ip` INET, `user_agent`, `request_id` UUID, `created_at`.
Índices: `(tenant_id, created_at DESC)`, `(tenant_id, entity_type, entity_id)`, `(tenant_id, actor_user_id, created_at)`.
Particionado por rango mensual desde el día 1 (§R.5). Retención: 24 meses en línea, después a cold storage.

#### `sync_events` (idempotencia offline)
`client_event_id` UUID PK, `tenant_id`, `user_id`, `entity_type`, `entity_id`, `received_at`, `result` JSONB.
Permite responder el mismo resultado si el cliente reintenta. TTL de 30 días.

#### `zones`, `vehicles`, `monitoring_stations`, `station_readings`
`zones`: `id`, `tenant_id`, `name`, `color`.
`vehicles`: `id`, `tenant_id`, `plate`, `model`, `assigned_to`.
`monitoring_stations` (Fase 2): `id`, `tenant_id`, `service_location_id`, `number`, `type`, `map_x`, `map_y`, `installed_at`, `status`.
`station_readings` (Fase 2): `id`, `tenant_id`, `service_session_id`, `station_id`, `consumption_level` ENUM(`NONE`,`LOW`,`MEDIUM`,`HIGH`), `captures` INT, `replaced` BOOLEAN, `condition` ENUM, `notes`.

### H.3 Diagrama de relaciones (resumen)

```
tenants ──┬── memberships ── users ── technician_profiles
          │                    │
          ├── customers ──┬── customer_contacts
          │               └── service_locations ──┬── monitoring_stations
          │                        │              │
          ├── service_contracts ───┘              │
          │        │                              │
          │        ▼                              │
          ├──── services ──── route_stops ──── routes ── vehicles
          │        │               │                        │
          │        │               ▼                        │
          │        │        service_sessions ───┬── service_evidence
          │        │               │            ├── service_supply_usage ── supplies ── supply_lots
          │        │               │            └── station_readings
          │        │               │
          │        ├── payments ───┴──► cash_movements ── cash_accounts ── cash_closures
          │        │
          │        └── certificates
          │
          ├── stock_locations ── inventory ◄── inventory_movements
          ├── price_lists ── price_list_items
          └── audit_logs · notifications · sync_events
```

### H.4 Decisiones de modelado que hay que respetar

1. **`inventory` y `cash_movements` nunca se editan.** Todo error se corrige con un asiento inverso. Es la única forma de que el número cierre y de que la auditoría sirva.
2. **`certificates.snapshot` congela los datos.** Si mañana cambia el nombre del producto o el número de matrícula del DT, el certificado emitido no cambia. Un certificado es un documento histórico.
3. **Los índices únicos parciales hacen el trabajo pesado.** Una sesión abierta por operario, una ruta por operario por día, un stop activo por servicio, una rendición abierta por caja. Cuatro constraints que eliminan cuatro clases enteras de bug de concurrencia sin una línea de código de aplicación.
4. **`client_event_id` en toda entidad creable desde el campo.** Es lo que hace segura la sincronización offline.
5. **No hay tabla `roles` global.** Cada tenant tiene sus roles, aunque arranquen idénticos. Retrofittear esto en Fase 3 sería doloroso.

---
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
## J. API REST

### J.1 Convenciones

- Base: `https://api.fumibug.app/v1`. **Versión en el path desde el día 1.**
- Auth: `Authorization: Bearer <access_token>` (JWT de Supabase, verificado por JWKS).
- Tenant: se toma **del token** (claim `tenant_id`), nunca de un header o del body. Un header `X-Tenant-Id` sería un agujero de seguridad.
- Idempotencia: header `Idempotency-Key` en todo `POST` mutante originado en el campo.
- Concurrencia: header `If-Match: <version>` en `PUT`/`PATCH` de entidades versionadas → `409` si no coincide.
- Paginación: cursor (`?cursor=&limit=`) en listas de alto volumen; offset solo donde hace falta salto a página.
- Formato de respuesta:

```jsonc
// éxito
{ "success": true, "data": {...}, "meta": { "cursor": "...", "hasMore": true } }
// error
{ "success": false, "error": { "code": "ROUTE_HAS_STARTED_STOPS",
  "message": "No se puede despublicar: 2 servicios ya comenzaron.",
  "details": [{ "field": "stopIds", "value": ["..."] }] },
  "requestId": "01J..." }
```

- Códigos: `400` validación · `401` sin token/expirado · `403` sin permiso · `404` no existe **o no es de tu tenant** · `409` conflicto de estado o versión · `422` regla de negocio violada · `429` rate limit · `500` con `requestId`.
- Los `error.code` son un enum estable y documentado. **El frontend nunca parsea `message`.**

### J.2 Endpoints

**Auth**
| Método | Endpoint | Qué hace | Rol |
|---|---|---|---|
| POST | `/auth/login` | Email/username + password/PIN → tokens | público |
| POST | `/auth/refresh` | Rotación de refresh token | público |
| POST | `/auth/logout` | Revoca refresh | auth |
| GET | `/auth/me` | Usuario, tenant, rol, permisos efectivos | auth |
| POST | `/auth/password-reset` | Inicia recupero | público (rate limit fuerte) |
| POST | `/auth/pin` | Cambia PIN propio | auth |

**Clientes / ubicaciones**
`GET|POST /customers` · `GET|PATCH /customers/:id` · `POST /customers/:id/archive` · `GET /customers/:id/summary` (cuenta corriente + próximos servicios) · `GET|POST /customers/:id/locations` · `GET|PATCH /locations/:id` · `POST /locations/:id/geocode`

**Contratos**
`GET|POST /contracts` · `GET|PATCH /contracts/:id` · `POST /contracts/:id/pause` · `POST /contracts/:id/cancel` · `POST /contracts/:id/generate` (fuerza generación manual, idempotente)

**Servicios**
| Método | Endpoint | Qué hace | Permiso |
|---|---|---|---|
| GET | `/services?status=&from=&to=&customerId=&technicianId=&unassigned=true` | Lista filtrada | `service.read.*` |
| POST | `/services` | Crea | `service.create` |
| GET | `/services/:id` | Detalle con sesión, evidencia, insumos, pagos | `service.read.*` |
| PATCH | `/services/:id` | Edita (requiere `If-Match`) | `service.update` |
| POST | `/services/:id/cancel` | `{reason, billable}` | `service.cancel` |
| POST | `/services/:id/reschedule` | `{newDate, reason}` | `service.reschedule` |
| POST | `/services/:id/validate` | Aprueba cierre | `service.validate` |
| POST | `/services/:id/reject` | `{reason}` → vuelve a ejecución | `service.reject` |
| POST | `/services/:id/reopen` | `{reason}` — anula certificado | `session.reopen` |
| POST | `/services/:id/warranty-visit` | Genera revisita sin cargo | `service.create` |

**Rutas**
| Método | Endpoint | Qué hace | Permiso |
|---|---|---|---|
| GET | `/routes?date=&technicianId=&status=` | | `route.read.*` |
| POST | `/routes` | `{technicianId, date}` | `route.create` |
| GET | `/routes/:id` | Con stops ordenados | `route.read.*` |
| PATCH | `/routes/:id` | `If-Match` | `route.update` |
| POST | `/routes/:id/stops` | Agrega servicio a la ruta | `route.update` |
| PUT | `/routes/:id/stops/order` | `{stopIds:[...]}` reordena en una transacción | `route.update` |
| DELETE | `/routes/:id/stops/:stopId` | Quita (solo `PENDING`) | `route.update` |
| POST | `/routes/:id/validate` | **Dry-run de los guards.** Devuelve qué falta sin publicar | `route.read` |
| POST | `/routes/:id/publish` | Transacción atómica §I.R12 | `route.publish` |
| POST | `/routes/:id/unpublish` | | `route.unpublish` |
| POST | `/routes/:id/reassign` | `{newTechnicianId}` | `route.update` |
| POST | `/routes/:id/cancel` | | `route.cancel` |

**App de campo** — endpoints diseñados para offline
| Método | Endpoint | Qué hace |
|---|---|---|
| GET | `/field/today` | **Bundle completo del día**: ruta, stops, clientes, ubicaciones, historial, stock del operario, catálogo de insumos. Una sola llamada, cacheable, con `ETag`. Es lo que el service worker descarga al publicarse la ruta. |
| GET | `/field/routes/:id` | Refresco de una ruta |
| POST | `/field/stops/:id/en-route` | `{occurredAt, lat, lng, accuracy, gpsStatus, clientEventId}` |
| POST | `/field/stops/:id/arrive` | idem |
| POST | `/field/stops/:id/no-show` | `{reason, evidenceIds, clientEventId}` |
| POST | `/field/stops/:id/inaccessible` | `{reason, evidenceIds, clientEventId}` |
| POST | `/field/services/:id/start` | Abre sesión → `201` con sesión |
| POST | `/field/sessions/:id/pause` · `/resume` | |
| POST | `/field/sessions/:id/supplies` | Registra consumo (genera movimiento de inventario) |
| DELETE | `/field/sessions/:id/supplies/:usageId` | Solo con sesión abierta |
| POST | `/field/sessions/:id/evidence/upload-url` | Devuelve URL firmada de Supabase Storage + `storagePath` |
| POST | `/field/sessions/:id/evidence` | Confirma la subida y crea el registro |
| POST | `/field/sessions/:id/signature` | |
| POST | `/field/sessions/:id/payment` | |
| POST | `/field/sessions/:id/finish` | Valida checklist → `422` con lista exacta de faltantes |
| POST | `/field/sync` | **Batch**: array de eventos encolados, procesados en orden con idempotencia. Devuelve resultado por evento. |
| GET | `/field/my-stock` | Stock del vehículo del operario |
| POST | `/field/cash/close` | Rendición |

**Inventario**
`GET /supplies` · `POST /supplies` · `PATCH /supplies/:id` · `GET /inventory?locationId=` · `GET /inventory/movements?...` · `POST /inventory/transfer` · `POST /inventory/adjust` · `POST /inventory/purchase` · `GET /inventory/alerts`

**Dinero**
`GET /payments?...` · `POST /payments` · `POST /payments/:id/void` · `GET /cash/accounts` · `GET /cash/accounts/:id/movements` · `GET /cash/closures?status=` · `POST /cash/closures/:id/reconcile` (`{receivedCents, differenceReason}`) · `POST /cash/adjust`

**Certificados**
`GET /certificates?...` · `POST /certificates` (`{serviceId}`) · `POST /certificates/batch` · `POST /certificates/:id/sign` · `POST /certificates/:id/void` · `GET /certificates/:id/pdf` (redirect a URL firmada, TTL 5 min) · `POST /certificates/:id/send` · **`GET /public/verify/:token`** (sin auth, rate-limited: muestra número, fecha, cliente y estado — nada más)

**Reportes** — `GET /reports/:key?from=&to=&...` con `?format=json|csv|xlsx`. Si el resultado supera 5.000 filas, devuelve `202` con `jobId` y se descarga después.

**Admin** — `/users`, `/roles`, `/settings`, `/audit-logs`, `/notifications`, `/push/subscribe`

### J.3 Ejemplo completo: publicar ruta

```http
POST /v1/routes/9f3a.../publish
Authorization: Bearer eyJ...
Idempotency-Key: 7c1e...
If-Match: 4
```
```jsonc
// 200
{ "success": true, "data": {
  "route": { "id":"9f3a...", "status":"PUBLISHED", "version":5, "publishedAt":"2026-08-21T11:04:12Z" },
  "servicesUpdated": 7, "notificationSent": true } }

// 422 — guards no cumplidos
{ "success": false, "error": {
  "code": "ROUTE_VALIDATION_FAILED",
  "message": "La ruta no cumple los requisitos para publicarse.",
  "details": [
    { "code":"TECHNICIAN_LICENSE_EXPIRED", "message":"La libreta sanitaria de Juan Pérez venció el 2026-08-10." },
    { "code":"INSUFFICIENT_STOCK", "message":"Falta Cipermetrina 25%: requiere 2.4 L, hay 0.8 L.",
      "value": { "supplyId":"...", "required":2.4, "available":0.8 } }
  ] } }

// 409 — otro admin la modificó
{ "success": false, "error": { "code":"VERSION_CONFLICT",
  "message":"La ruta fue modificada por Ana López hace 40 segundos.",
  "details":[{ "currentVersion":5 }] } }
```

### J.4 Contrato compartido

Todos los DTOs se definen **una sola vez** con Zod en `packages/contracts`, y de ahí salen: validación en NestJS (pipe), tipos de TypeScript (`z.infer`), tipos del cliente frontend, mocks de MSW, y el OpenAPI generado. **El frontend nunca redefine un tipo de la API.** Esta es la regla que evita que Claude Code y OpenCode diverjan (§V).

---
## K. SEGURIDAD

### K.1 Autenticación — decisión y justificación

**Supabase Auth como identity provider, NestJS como authorization server.**

Comparación honesta:

| Opción | A favor | En contra | Veredicto |
|---|---|---|---|
| JWT propio en NestJS | Control total, sin dependencia | Hay que construir: hashing, reset de password, rotación de refresh, revocación, MFA futuro, rate limiting de login. Semanas de trabajo y superficie de bugs de seguridad. | No |
| Supabase Auth + Nest verifica | Password reset, MFA, rate limiting y rotación ya resueltos y auditados. El token es un JWT estándar verificable por JWKS sin llamar a Supabase en cada request. | Dependencia de proveedor; el claim de tenant hay que agregarlo. | **Sí** |
| NextAuth/Auth.js | Cómodo en Next | La sesión vive en el frontend; con backend separado hay que puentear igual. | No |

**El problema concreto de los operarios:** no tienen email. Solución: al crear un operario, el sistema genera `{username}@{tenant-slug}.fumibug.internal` en Supabase Auth. El operario ve y tipea solo `jperez` + PIN de 6 dígitos. El PIN se trata como password (política mínima: no secuencial, no repetido, no fecha de nacimiento; bloqueo a los 5 intentos por 15 minutos; obliga a cambiarlo en el primer login).

**Claims custom:** un Auth Hook de Supabase inyecta en el token `tenant_id`, `role_key` y `permissions[]` al emitirlo. NestJS lo verifica con JWKS cacheado y arma el `RequestContext`.

**Tokens:** access 15 min, refresh 7 días en admin / 30 días en campo (rotativo, con detección de reuso). Refresh en cookie `httpOnly`+`Secure`+`SameSite=Strict` para el admin; en campo va en almacenamiento seguro del dispositivo porque la PWA debe poder revalidar sin red.

**Revocación:** `token_version` por usuario en DB, verificada en refresh. Suspender a alguien lo saca en ≤15 minutos, sin Redis.

### K.2 Autorización

Guards de NestJS componibles:

```ts
@UseGuards(JwtGuard, TenantGuard, PermissionGuard)
@RequirePermission('route.publish')
@Post(':id/publish')
```

- `JwtGuard` verifica firma y expiración.
- `TenantGuard` carga `tenant_id` del token al `AsyncLocalStorage` del request.
- `PermissionGuard` chequea el permiso y aplica el scope (`own` inyecta el filtro por `technician_id = user.id`).
- **La verificación de scope `own` es del lado del servidor, siempre.** El frontend oculta botones; eso no es seguridad.

### K.3 Multi-tenancy: por qué RLS sola no alcanza

Si NestJS se conecta con el rol `service_role` de Supabase o con un superusuario, **RLS no se aplica** — Postgres la salta. Eso convierte a la RLS en teatro. Muchos proyectos "multi-tenant con RLS" no están aislados en absoluto.

### K.4 Aislamiento real: tres capas

**Capa 1 — Extensión de Prisma (defensa principal).**
```ts
prisma.$extends({
  query: { $allModels: {
    async $allOperations({ model, operation, args, query }) {
      if (TENANT_SCOPED_MODELS.has(model)) {
        const tenantId = ctx.getStore()?.tenantId
        if (!tenantId) throw new Error(`Query a ${model} sin tenant en contexto`)
        args.where = { ...args.where, tenantId }
        if (operation.startsWith('create')) args.data = { ...args.data, tenantId }
      }
      return query(args)
    }}})
```
Olvidarse el `tenant_id` deja de ser posible: la query directamente falla.

**Capa 2 — RLS de Postgres (red de seguridad).**
La app se conecta con un rol dedicado **sin `BYPASSRLS`**. Cada request abre transacción y ejecuta `SET LOCAL app.tenant_id = '<uuid>'`. Las policies:
```sql
CREATE POLICY tenant_isolation ON services
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```
Si la Capa 1 tuviera un bug, la Capa 2 devuelve cero filas en lugar de datos ajenos.

**Capa 3 — Test automatizado.**
Un test de arquitectura que crea dos tenants con datos, se autentica como usuario del tenant A, y recorre **todos** los endpoints de lectura intentando acceder a IDs del tenant B. Debe devolver `404` en todos. Este test corre en CI y es bloqueante. Se agrega un endpoint nuevo → se agrega su caso al test, o el PR no pasa.

### K.5 Validación

Zod en el borde de entrada, sin excepción. `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`: un campo que no está en el schema hace fallar el request en lugar de colarse al ORM. Prisma parametriza todo, así que la inyección SQL no es un vector — salvo en `$queryRaw`, que solo se usa con `Prisma.sql` template tags y está prohibido concatenar strings.

### K.6 Rate limiting

| Endpoint | Límite |
|---|---|
| `/auth/login` | 5 / 15 min por IP **y** por identificador |
| `/auth/password-reset` | 3 / hora por email |
| `/public/verify/:token` | 30 / min por IP |
| `/field/sync` | 60 / min por usuario (una sincronización con backlog manda muchos eventos) |
| Global autenticado | 300 / min por usuario |
| Global anónimo | 60 / min por IP |

MVP con almacenamiento en memoria (una sola instancia). Al pasar a 2+ instancias, migrar a Redis — es el primer disparador real de Redis (§R.4).

### K.7 Upload seguro de imágenes

1. Cliente pide URL firmada a la API (`POST /field/sessions/:id/evidence/upload-url`). La API valida permiso, mime type y tamaño máximo, y devuelve una URL de Supabase Storage válida 10 minutos con path **determinado por el servidor**: `{tenant_id}/{service_id}/{uuid}.webp`. El cliente **nunca** elige el path.
2. Sube directo a Storage. No pasa por Railway (ancho de banda y timeouts).
3. Confirma con `POST .../evidence` enviando `sha256` y tamaño. La API verifica contra el objeto real.
4. Bucket **privado**. Lectura solo por URL firmada de 5 minutos generada por la API tras verificar permiso.
5. Se strippea EXIF en el cliente antes de subir; la geolocalización se guarda en columnas, no en el archivo.
6. Validación de magic bytes en la confirmación, no confianza en la extensión.
7. Un job asincrónico revisa objetos huérfanos (subidos sin confirmar) y los borra a las 24 h.

### K.8 Secretos

Nada de secretos en el repo, ni en `next.config`, ni en variables `NEXT_PUBLIC_*` (que son públicas por definición y hay que tratarlas como tales). `.env.example` con **todas** las claves y sin un solo valor real. Secretos en Railway/Vercel/GitHub Secrets. Rotación documentada. El `service_role` key de Supabase **jamás** llega al frontend — es la fuga clásica de este stack.

### K.9 Headers y transporte

Helmet con CSP estricta, HSTS con preload, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. CORS con allowlist explícita (no `*`, no reflejar el origin). HTTPS forzado. La PWA requiere HTTPS de todos modos.

### K.10 Auditoría

Interceptor de NestJS que registra toda mutación: actor, rol, acción, entidad, `before`/`after`, diff, IP, user agent, `requestId`, severidad. Se escribe **en la misma transacción** que la mutación (si no, hay operaciones sin rastro cuando falla el log). Tabla append-only con trigger que rechaza `UPDATE`/`DELETE`.

Severidad `CRITICAL` (revisión periódica obligatoria): reapertura de servicio cerrado, anulación de pago, ajuste de inventario, ajuste de caja, cambio de permisos, anulación de certificado, autoaprobación de rendición, login desde IP nueva de un usuario admin.

### K.11 Protección de datos personales

La Ley 25.326 de Protección de Datos Personales aplica: hay domicilios, teléfonos y DNI de clientes.

- Minimización: no se pide más de lo necesario. El DNI del firmante es opcional.
- **Los logs no contienen datos personales.** Se loguean IDs, no nombres ni direcciones.
- Derecho de supresión: procedimiento de anonimización (reemplaza nombre/dirección/teléfono por tokens, conserva los registros contables y sanitarios que la normativa obliga a mantener).
- Retención: fotos de evidencia 24 meses en caliente, después a storage frío; certificados sin límite (documento sanitario).
- Export de datos del cliente en JSON a pedido.

### K.12 Backups

Supabase hace PITR según plan. Encima de eso: **dump lógico diario propio** (`pg_dump`) a un bucket externo, cifrado, con retención 30 días. Un backup que nunca se restauró no es un backup: **restauración de prueba mensual documentada**, con el resultado anotado en `/docs/runbooks/restore-log.md`.

### K.13 Riesgos específicos de este dominio

| Riesgo | Mitigación |
|---|---|
| Operario "clona" el registro de un servicio sin haberlo hecho | Coordenada + timestamp del servidor + fotos con hash + duración mínima por tipo de servicio. Reporte de anomalías: servicios de duración sospechosamente corta, coordenadas repetidas exactas, fotos idénticas por hash. |
| Falsificación de GPS (apps de fake location) | No se puede prevenir en web. Se detecta por patrón: precisión perfecta constante, coordenada idéntica al centroide, saltos imposibles entre stops. Se reporta, no se bloquea. |
| Operario se lleva la base de clientes | El scope `own` limita la exposición a sus stops del día. Rate limiting por usuario. Alerta por volumen anómalo de lecturas. |
| Foto de comprobante de transferencia falsificada | El admin valida contra el extracto bancario. El sistema registra, no verifica — y eso está documentado explícitamente para no dar falsa confianza. |
| Robo del celular con sesión activa | PIN al reabrir tras 15 min de inactividad. Cierre remoto de sesión desde el admin. Sin datos financieros globales en el dispositivo. |

---
## L. OFFLINE / PWA

### L.1 La pregunta correcta

No es "¿debería funcionar offline?" sino "¿qué pasa si un operario trabaja 3 horas en un sótano sin señal?". En el conurbano bonaerense, en depósitos, en subsuelos y en zonas rurales, eso pasa **todos los días**. Si la app no funciona ahí, el operario vuelve al cuaderno y el proyecto fracasa.

Pero offline-first completo (sincronización bidireccional con resolución de conflictos, tipo CRDT o Replicache) es un proyecto en sí mismo. La respuesta correcta es **offline asimétrico**.

### L.2 Modelo: lectura cacheada + escritura encolada

**Offline (obligatorio en el MVP):**

| Funcionalidad | Mecanismo |
|---|---|
| Ver ruta del día completa | Precache del bundle `/field/today` al publicarse la ruta |
| Ver cliente, dirección, notas, historial | Incluido en el bundle |
| Ver catálogo de insumos y stock propio | Incluido en el bundle |
| Marcar en camino / llegué | Evento encolado |
| Iniciar y finalizar servicio | Evento encolado |
| Sacar y categorizar fotos | Blob en IndexedDB + evento encolado |
| Observaciones | Evento encolado |
| Registrar insumos | Evento encolado (validación de stock diferida) |
| Registrar pago | Evento encolado |
| Firma del cliente | Evento encolado |
| Marcar ausente / inaccesible | Evento encolado |
| Cerrar jornada y rendir | Evento encolado |

**Requiere conexión (aceptable):**
- Login inicial en un dispositivo nuevo
- Ver rutas de días distintos al actual
- Cualquier pantalla de admin
- Emisión de certificados
- Reportes

### L.3 Arquitectura de sincronización

```
Acción del usuario
   │
   ├─► Escritura optimista en IndexedDB (Dexie)  ──► la UI se actualiza YA
   │
   └─► push a outbox { clientEventId, type, payload, occurredAt, deps[], attempts }
            │
            ▼
   SyncEngine (background)
     · dispara con: online, foco de la app, timer 30 s, Background Sync API donde exista
     · procesa en orden causal (deps): sesión → insumos → fotos → pago → firma → cierre
     · POST /field/sync con lote de hasta 20 eventos
     · backoff exponencial 2^n con jitter, tope 5 min, máximo 10 intentos
     · éxito → marca aplicado y reconcilia con la respuesta del servidor
     · error 4xx no recuperable → marca FAILED, muestra al usuario, no reintenta a ciegas
     · error 5xx / red → reintenta
```

**Idempotencia (§I.R43):** cada evento lleva `clientEventId`. El servidor lo guarda en `sync_events`. Un reintento devuelve el resultado original. Sin esto, un backoff genera pagos duplicados.

**Fotos:** cola aparte, subida de a una para no saturar la conexión, con reanudación. La foto no se borra de IndexedDB hasta que el servidor confirma el hash.

**Conflictos:** el servidor gana en catálogos (precios, datos del cliente). El dispositivo gana en hechos ocurridos (el servicio se ejecutó, punto). Si el servidor detecta contradicción — servicio cancelado mientras el operario trabajaba — acepta y marca `conflict_flag` para que un humano decida (§I.R45).

**Reloj:** se guarda `occurred_at` del dispositivo y `recorded_at` del servidor. En cada sincronización exitosa se mide el offset y se guarda. Diferencia >15 min → `clock_skew_flag` visible para el admin. No se corrige silenciosamente.

### L.4 Service worker

- `next-pwa` / Workbox.
- **Scope `/campo`.** El admin no necesita service worker y complicaría los deploys.
- App shell: `CacheFirst` con versionado por build.
- `/field/today`: `NetworkFirst` con timeout de 3 s y fallback a caché.
- Storage de fotos ya subidas: `CacheFirst` con expiración de 7 días.
- API mutante: **nunca** cacheada. Va por el outbox.
- Aviso no intrusivo cuando hay versión nueva. **Nunca actualización forzada en medio de un servicio**: se aplica al cerrar el stop o al abrir la app.
- `beforeinstallprompt` capturado para ofrecer instalación en el momento correcto (después del primer servicio completado, no al entrar).

### L.5 Presupuesto de almacenamiento

Una jornada de 8 servicios × 6 fotos × 250 KB ≈ 12 MB. Con margen: **límite de 150 MB**. Purga automática de datos de más de 7 días ya sincronizados. Si se acerca al límite, avisa. Solicitar `navigator.storage.persist()` para que el navegador no evacúe la caché.

### L.6 Lo que NO se hace

- **No** offline para el admin. Complejidad enorme, valor nulo.
- **No** resolución automática de conflictos complejos. Un humano decide.
- **No** replicación completa de la base al dispositivo.
- **No** app nativa en el MVP. La PWA cubre todo lo necesario; si en producción aparecen límites reales (cámara, background), se evalúa Capacitor en Fase 3 reutilizando el mismo código.

---

## M. GPS Y MAPAS

### M.1 Lo que hay que asumir sobre el GPS

Ningún diseño que suponga GPS confiable sobrevive al primer día en campo:

- La precisión urbana entre edificios va de 5 m a 500 m.
- El usuario puede negar el permiso y no hay forma de obligarlo.
- iOS Safari exige HTTPS y contexto de interacción del usuario.
- **Una PWA no puede hacer tracking en segundo plano.** No existe Background Geolocation en la web. Si el operario minimiza la app, no hay posición. Cualquier promesa de "tracking en tiempo real" con una PWA es falsa.
- Las apps de fake location existen y funcionan.

Por eso: **el GPS es evidencia, no control**.

### M.2 MVP

| Funcionalidad | Implementación |
|---|---|
| Geocoding de direcciones | Google Geocoding API al crear la ubicación, resultado persistido. Corrección manual arrastrando un pin. **Nunca se geocodifica en tiempo real repetidamente** (costo). |
| Navegación | Links: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` y `https://waze.com/ul?ll={lat},{lng}&navigate=yes`. Cero costo, cero mantenimiento, el operario ya sabe usarlos. |
| Coordenada de llegada | `getCurrentPosition` con `enableHighAccuracy:true`, timeout 10 s, `maximumAge:0`. Se guarda `lat`, `lng`, `accuracy_m`, `gps_status`. |
| Coordenada de inicio/fin | Igual. |
| Distancia a la ubicación | Haversine calculado en el servidor. Se guarda `distance_from_location_m`. |
| Advertencia de geocerca | Si supera el radio configurado (default 300 m), advertencia no bloqueante. |
| Mapa en el admin | `@vis.gl/react-google-maps` con marcadores. Sin renderizado de rutas en el MVP. |

Costo estimado de Google Maps: con geocoding persistido y sin Distance Matrix, se queda cómodamente dentro del crédito mensual gratuito. **Poner un límite de gasto en la consola de Google desde el día 1** — es un error clásico y caro.

### M.3 Futuro (con disparador explícito)

| Funcionalidad | Cuándo | Por qué esperar |
|---|---|---|
| Distance Matrix para ETA de traslado | Fase 2 | Cuesta plata por request y el MVP se banca con `travel_minutes` manual. |
| Optimización automática de orden (TSP) | Fase 2/3 | Es un problema con ventanas horarias, habilidades y prioridades. Mal resuelto, el admin lo desactiva el segundo día. Antes hay que tener datos reales de duración de traslados. |
| Trazado de ruta en el mapa | Fase 2 | Cosmético hasta que haya optimización. |
| Tracking periódico | Fase 3, **solo con app nativa/Capacitor** | Imposible en PWA. Y tiene implicancias laborales y de privacidad que hay que conversar con la empresa antes de construirlo. |
| Geofencing automático (detectar llegada sin tap) | Fase 3 | Mismo problema: requiere background. |
| Mapa de calor de plagas por zona | Fase 3 | Diferencial comercial fuerte una vez que hay 2 años de datos. |

---
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
## Q. MULTI-TENANCY / SAAS

### Q.1 Estrategia de aislamiento

| Estrategia | Aislamiento | Costo operativo | Veredicto |
|---|---|---|---|
| Base por tenant | Máximo | Migraciones × N bases, backups × N, conexiones × N | No hasta enterprise |
| Schema por tenant | Alto | Migraciones × N schemas, límites de Postgres ~ cientos | No |
| **Fila con `tenant_id` + RLS + capa de app** | Suficiente si se hace bien | Una migración, un backup, un pool | **Sí** |

Con las tres capas de §K.4 el riesgo real es aceptable. Y si mañana un cliente enterprise exige base dedicada, el mismo código funciona apuntando a otra conexión: el `tenant_id` sigue estando.

### Q.2 Modelo comercial

```
tenant ─┬─ subscription ─── plan ─── plan_features
        ├─ memberships ─── users
        ├─ usage_counters (servicios/mes, usuarios activos, GB de storage)
        └─ [todos los datos de negocio]
```

Tablas de Fase 3 (**no** se construyen en el MVP, pero `tenants.plan` existe desde el día 1 para no migrar después):
`plans`, `plan_features`, `subscriptions`, `usage_counters`, `invoices`.

Planes propuestos (hipótesis a validar con clientes reales, no con una planilla):

| | Core | Pro | Enterprise |
|---|---|---|---|
| Operarios | hasta 5 | hasta 20 | ilimitado |
| Servicios/mes | 300 | 2.000 | ilimitado |
| Certificados | ✔ | ✔ | ✔ |
| Contratos recurrentes | ✔ | ✔ | ✔ |
| Estaciones de monitoreo | — | ✔ | ✔ |
| Portal del cliente | — | ✔ | ✔ |
| WhatsApp automatizado | — | ✔ | ✔ |
| API / integraciones | — | — | ✔ |
| Marca propia en certificados | logo | logo + colores | dominio propio |
| Storage | 5 GB | 50 GB | a medida |

### Q.3 Cómo se garantiza que una empresa no vea otra

Ya está en §K.4, pero resumido para que quede como checklist verificable:

1. `tenant_id` en toda tabla de negocio — **verificado por test de schema** que lista las tablas y falla si alguna no lo tiene.
2. Extensión de Prisma que inyecta el filtro — imposible olvidarlo.
3. RLS de Postgres con rol sin `BYPASSRLS` — red de seguridad.
4. `tenant_id` viene del JWT, jamás del request.
5. Recursos ajenos devuelven `404`, no `403`.
6. Los paths de Storage empiezan por `tenant_id` y las policies del bucket lo verifican.
7. Test de aislamiento cross-tenant bloqueante en CI, ampliado con cada endpoint nuevo.
8. Auditoría con `tenant_id` — cualquier acceso cruzado queda registrado.

### Q.4 Onboarding SaaS (Fase 3)

Registro → verificación de email → crear empresa (nombre, CUIT, habilitación sanitaria) → wizard de 3 pasos (cargar Director Técnico, cargar 3 insumos frecuentes, cargar el primer cliente) → **momento de valor**: crear y publicar el primer servicio en menos de 10 minutos → invitar operarios por link con PIN temporal.

Trial de 14 días sin tarjeta. Import de clientes por CSV desde el primer día — nadie migra 400 clientes a mano, y es el mayor obstáculo de conversión.

### Q.5 Lo que hay que resistir

No construir billing, planes, feature flags ni onboarding autoservicio hasta tener **la segunda empresa pagando**. Es la trampa clásica: seis meses construyendo infraestructura SaaS para un producto que todavía no demostró que resuelve el problema de la primera empresa.

---

## R. ESCALABILIDAD

### R.1 Arquitectura base: monolito modular

```
┌──────────────────────────────────────────────────────┐
│ Vercel — Next.js (App Router)                        │
│   (admin)  desktop, sin service worker               │
│   (campo)  PWA, service worker scopeado a /campo     │
└───────────────────────┬──────────────────────────────┘
                        │ HTTPS / REST
┌───────────────────────▼──────────────────────────────┐
│ Railway — NestJS (monolito modular)                   │
│   modules/{auth,customers,services,routes,field,      │
│            inventory,payments,cash,certificates,      │
│            reports,audit,notifications}               │
│   + Prisma + guards + interceptor de auditoría        │
└───────────┬───────────────────────┬──────────────────┘
            │                       │
┌───────────▼──────────┐  ┌─────────▼──────────────────┐
│ Supabase Postgres    │  │ Supabase Storage (privado) │
│ (+ Auth, + RLS)      │  │ evidencia, certificados    │
└──────────────────────┘  └────────────────────────────┘
```

**Una sola app Next.js, dos route groups.** Justificación: un design system, un deploy, una sesión, un pipeline. Dos apps separadas duplicarían la superficie donde Claude Code y OpenCode pueden pisarse, que es justo lo que queremos minimizar. El service worker se scopea a `/campo` y el manifest declara `start_url: /campo`, así el operario instala "Fumibug Campo" y el admin nunca carga el SW.

**¿Por qué NestJS separado y no todo en Next.js API routes?** Tres razones concretas: (a) los guards e interceptores de Nest mapean uno a uno con RBAC + tenant + auditoría, y en Next habría que armarlo a mano en cada handler; (b) los jobs (generador de contratos, cierre de sesiones colgadas, reconciliación de inventario) necesitan un proceso persistente, y las serverless functions de Vercel no sirven para eso; (c) la separación es exactamente la línea de corte entre los dos agentes de código.

### R.2 Fase 10 empresas (~50 operarios, ~3.000 servicios/mes)

Lo de arriba, tal cual. Una instancia de Railway, Supabase plan Pro, pool con PgBouncer en modo transaction. **No hace falta nada más.** Costo aproximado: USD 60–100/mes.

Lo único no negociable desde el día 1: **Sentry** (errores) y logs estructurados en JSON. Debuggear un problema de campo sin trazas es imposible.

### R.3 Fase 100 empresas (~500 operarios, ~30.000 servicios/mes)

Se agrega, **en este orden y cada uno por un síntoma concreto**:

| Componente | Disparador | Para qué |
|---|---|---|
| **Redis** (Upstash) | 2+ instancias de API, o rate limiting inconsistente | Rate limiting distribuido, caché de permisos y de catálogos, locks distribuidos |
| **BullMQ + worker** | Los PDFs tardan y bloquean el request | Generación de certificados, envío de emails/WhatsApp, exports grandes, generador de contratos, procesamiento de imágenes |
| **Réplica de lectura** | Los reportes hacen lento el operativo | Reportes y vistas materializadas contra la réplica |
| **Particionado** de `audit_logs`, `inventory_movements`, `cash_movements` | >20M filas | Rango mensual. **Definir la estrategia desde el MVP** aunque se aplique después: convertir una tabla enorme a particionada en producción es una noche larga |
| **CDN de imágenes** | Costo de egress de Storage visible | Cloudflare Images o transformaciones de Supabase, con thumbnails |
| **Observabilidad** | Empieza a haber lentitud sin causa clara | Sentry Performance + OpenTelemetry + dashboard de latencia p95 por endpoint |
| **PostGIS** | Se necesitan queries "todo lo que está a menos de X km" | En MVP, Haversine en SQL alcanza |

Costo aproximado: USD 400–800/mes.

### R.4 Fase 1.000 empresas (~5.000 operarios)

- API horizontal en 4–8 instancias detrás de load balancer. **El monolito escala horizontal sin problema** porque no tiene estado.
- Postgres: instancia grande + 2 réplicas. Si hace falta más, **sharding por tenant** (los tenants grandes a su propia base) antes que microservicios.
- Storage con lifecycle a almacenamiento frío para evidencia de más de 24 meses.
- Workers dedicados por tipo de cola.
- Multi-región solo si hay clientes fuera de Argentina.

**Cuándo microservicios: probablemente nunca.** Un FSM tiene transacciones que cruzan servicios, rutas, inventario y caja; partirlo en servicios convierte transacciones ACID en sagas distribuidas, que es exactamente donde el dinero deja de cerrar. Si algo se extrae algún día, será la generación de PDFs y el procesamiento de imágenes — que ya son workers, no microservicios.

**Cuándo WebSockets:** cuando el admin pida ver el mapa moviéndose en vivo. Hasta entonces, polling de 60 s en la pantalla "Hoy" resuelve el 100% de la necesidad con 0% de la complejidad. Y si se hace, Supabase Realtime antes que un servidor de sockets propio.

### R.5 Reglas de performance desde el día 1

Cuestan poco ahora y son caras después:

1. Paginación obligatoria en **toda** lista. Sin excepción, ni siquiera "clientes" que hoy son 200.
2. `select` explícito en Prisma. Nunca traer la entidad completa por comodidad.
3. Índice compuesto `(tenant_id, ...)` en toda query frecuente.
4. Test que detecta N+1 contando queries por request en los endpoints principales.
5. `EXPLAIN ANALYZE` en las 10 queries más pesadas antes de cada release.
6. Imágenes con `next/image`, fuentes con `next/font`, imports dinámicos en planificador y mapas.
7. Presupuesto de bundle para `/campo`: **< 200 KB gzip de JS inicial**. Se mide en CI y **rompe el build** si se excede. El operario está en 3G.

---
## S. MVP

Criterio: **el MVP tiene que reemplazar el cuaderno y el Excel de Fumibug por completo.** Si el admin sigue necesitando el Excel para algo, el MVP falló, aunque tenga 40 pantallas lindas.

### MUST HAVE (sin esto no se usa)

| Bloque | Alcance |
|---|---|
| Auth y roles | Login admin (email) y operario (usuario+PIN). 6 roles semilla. Permisos granulares. |
| Clientes y ubicaciones | CRUD, búsqueda, contactos, geocoding con corrección manual. |
| Servicios | CRUD, alta rápida, estados completos, cancelación, reprogramación. |
| **Contratos recurrentes** | Alta, regla de recurrencia, generador automático. |
| Planificador | Vista día/semana, drag & drop, detección de conflictos. |
| Rutas | Armado, orden, validación, publicación atómica, despublicación, reasignación. |
| App de campo | Flujo completo §F.2, **funcionando offline**. |
| Evidencia | Fotos con categoría, compresión, upload directo, cola offline, firma. |
| Insumos e inventario | Catálogo con datos de registro, multi-ubicación, lotes, transferencias, consumo con dilución, alertas. |
| Pagos y caja | Efectivo y transferencia, caja por operario, rendición con diferencia. |
| **Certificados** | Emisión desde datos reales, numeración correlativa, firma del DT, PDF, envío. |
| Validación de cierres | Cola, aprobación, rechazo con motivo. |
| Dashboard | Admin + Owner. |
| Reportes | 8 reportes esenciales: servicios por estado, productividad por operario, ingresos por período, cobrado por método, consumo de insumos, stock actual, rendiciones, certificados emitidos. |
| Auditoría | Log completo + pantalla de consulta. |
| Notificaciones | In-app + push web para publicación y cambios de ruta. |
| Multi-tenancy | `tenant_id`, RLS, tres capas de aislamiento. **Un solo tenant en uso.** |
| Configuración | Empresa, DT, tipos de servicio, zonas, listas de precios, parámetros. |

### SHOULD HAVE (Fase 2, alto valor)

Estaciones de monitoreo e informe de tendencia · portal del cliente por link firmado · WhatsApp automatizado (recordatorio + aviso de llegada + envío de certificado) · presupuestos · Distance Matrix para ETA · reporte de rentabilidad · import CSV de clientes · gastos del operario · adjuntos en cliente · checklists configurables por tipo de servicio.

### NICE TO HAVE (Fase 3)

Optimización automática de orden de ruta · firma digital con certificado · app nativa vía Capacitor · encuesta de satisfacción post-servicio · mapa de calor de plagas · comisiones por operario · integración con MercadoPago (link de cobro) · dashboard de KPIs configurable.

### FUTURO

Facturación electrónica ARCA (ex-AFIP) · portal de autogestión del cliente con reserva online · API pública · marketplace de integraciones · IA para predicción de reinfestación · reconocimiento de plaga por foto · billing SaaS completo.

### Lo que NO se hace en el MVP y por qué

| No se hace | Motivo |
|---|---|
| Tracking GPS en tiempo real | Técnicamente imposible en PWA. Prometerlo genera una expectativa que no se puede cumplir. |
| Optimización automática de rutas | Sin datos reales de traslado, la heurística da resultados peores que el admin. Se construye en Fase 2 con datos. |
| Facturación ARCA | Es un proyecto propio (certificados, homologación, puntos de venta). Fumibug ya factura con su sistema contable. Se integra en Fase 4. |
| WhatsApp Business API | Verificación de Meta, plantillas aprobadas, costo por conversación. El `wa.me` manual da el 80% del valor con 5% del esfuerzo. |
| Billing / Stripe | No hay segundo cliente. |
| Offline en el admin | Complejidad alta, valor nulo. |
| App nativa | La PWA cubre todo lo necesario. Se evalúa con datos de producción. |
| Modo oscuro | Sin valor operativo. Fase 3. |
| Multi-idioma | Un solo mercado. |

---

## T. ROADMAP

Estimaciones para **dos agentes trabajando en paralelo con supervisión humana**. Suponen dedicación consistente, no full-time humano.

### FASE 0 — Fundaciones (semana 1)
Monorepo Turborepo + pnpm · `packages/contracts` con Zod · Prisma con schema completo y migraciones · seeds (tenant Fumibug, roles, permisos, 10 clientes, 5 insumos reales) · NestJS con auth, guards, tenant context, extensión de Prisma, interceptor de auditoría, manejo de errores · Next.js con layout, design system, tokens, cliente de API, TanStack Query, MSW · CI (lint, typecheck, tests, migración en efímera) · deploy de ambos entornos vacíos · `CLAUDE.md`, `AGENTS.md`, `/docs/adr/0001` a `0005`.

**Criterio de salida:** un endpoint dummy autenticado, con tenant, auditado, consumido desde el frontend deployado, con test en verde en CI. Nada de negocio todavía. Esta fase es la que decide si el resto sale bien o mal.

### FASE 1 — Núcleo operativo (semanas 2–5)
Usuarios y roles · clientes, contactos y ubicaciones · tipos de servicio, zonas, listas de precios · servicios con máquina de estados · planificador · rutas con publicación atómica · **app de campo completa con offline** · evidencia · validación de cierres · dashboard básico · auditoría.

**Criterio de salida:** un operario real hace un día completo de trabajo con la app y no necesita el cuaderno.

### FASE 2 — Plata, insumos y papeles (semanas 6–8)
Insumos, inventario multi-ubicación, lotes, transferencias, consumo con dilución · pagos · caja y rendiciones · **certificados con firma del DT** · contratos recurrentes y generador · 8 reportes · notificaciones push.

**Criterio de salida:** Fumibug deja de usar Excel. Los certificados salen del sistema. La caja cierra sola.

### FASE 3 — Producción y ajuste (semanas 9–11)
Uso real supervisado, corrección de fricciones detectadas en campo (siempre aparecen y siempre son distintas a lo previsto) · performance sobre datos reales · WhatsApp manual · import CSV · portal del cliente por link · endurecimiento de seguridad y pentest básico · runbooks y restore de prueba.

**Criterio de salida:** un mes completo de operación sin intervención técnica.

### FASE 4 — Segundo cliente y SaaS (semanas 12+)
Estaciones de monitoreo · onboarding autoservicio · planes y feature flags · límites de uso · billing · segunda empresa en producción · marca propia en certificados.

**Regla del roadmap:** no se arranca una fase sin cerrar el criterio de salida de la anterior. La tentación de saltar a Fase 4 antes de que Fumibug use el sistema todos los días es el modo más común de fracasar en esto.

---
## U. ESTRUCTURA DEL PROYECTO

Monorepo con **Turborepo + pnpm workspaces**. Justificación: los contratos compartidos son el mecanismo central de coordinación entre agentes (§V), y eso exige un solo repo.

```
fumibug/
├── apps/
│   ├── api/                          ◄── DUEÑO: Claude Code
│   │   ├── src/
│   │   │   ├── modules/              # feature-based, no layer-based
│   │   │   │   ├── auth/             # controller · service · guards · strategies
│   │   │   │   ├── customers/
│   │   │   │   ├── locations/
│   │   │   │   ├── contracts/
│   │   │   │   ├── services/
│   │   │   │   ├── routes/
│   │   │   │   ├── field/            # endpoints de la app operario
│   │   │   │   ├── inventory/
│   │   │   │   ├── payments/
│   │   │   │   ├── cash/
│   │   │   │   ├── certificates/
│   │   │   │   ├── reports/
│   │   │   │   ├── notifications/
│   │   │   │   └── audit/
│   │   │   ├── common/
│   │   │   │   ├── guards/           # jwt · tenant · permission
│   │   │   │   ├── interceptors/     # audit · logging · transform
│   │   │   │   ├── filters/          # exception filter global
│   │   │   │   ├── decorators/       # @CurrentUser @RequirePermission
│   │   │   │   ├── state-machine/    # servicio genérico de transiciones
│   │   │   │   └── tenant/           # AsyncLocalStorage + extensión Prisma
│   │   │   ├── jobs/                 # cron: contratos · sesiones colgadas · reconciliación
│   │   │   └── main.ts
│   │   └── test/                     # e2e · aislamiento cross-tenant · reglas de negocio
│   │
│   └── web/                          ◄── DUEÑO: OpenCode
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login
│       │   │   ├── (admin)/          # desktop
│       │   │   │   ├── dashboard · clientes · servicios · planificador
│       │   │   │   ├── rutas · hoy · validacion · certificados
│       │   │   │   ├── inventario · caja · reportes · configuracion · auditoria
│       │   │   └── (campo)/          # PWA — service worker scopeado acá
│       │   │       ├── ruta · stop/[id] · ejecucion/[id] · cierre · sync
│       │   ├── components/
│       │   │   ├── ui/               # design system base
│       │   │   ├── admin/
│       │   │   ├── field/
│       │   │   └── shared/
│       │   ├── lib/
│       │   │   ├── api/              ◄── GENERADO desde contracts. No se edita a mano
│       │   │   ├── offline/          # dexie · outbox · sync-engine
│       │   │   ├── auth/
│       │   │   └── utils/
│       │   ├── hooks/
│       │   ├── stores/               # zustand: solo estado de UI
│       │   └── styles/
│       └── public/                   # manifest · íconos · sw
│
├── packages/
│   ├── contracts/                    ◄── DUEÑO: Claude Code · LECTURA para OpenCode
│   │   └── src/{schemas,dto,enums,errors,index}.ts    # Zod = fuente única de verdad
│   ├── db/                           ◄── DUEÑO: Claude Code
│   │   ├── prisma/{schema.prisma,migrations,seed.ts}
│   │   └── src/client.ts
│   ├── ui/                           ◄── DUEÑO: OpenCode
│   │   └── src/{tokens.css,components,tailwind-preset.ts}
│   └── config/                       ◄── DUEÑO: humano (cambios por PR explícito)
│       └── {eslint,tsconfig,prettier}
│
├── docs/
│   ├── MASTER_SPEC.md                # este documento
│   ├── adr/                          # decisiones arquitectónicas
│   ├── api/openapi.json              # generado
│   └── runbooks/
│
├── .github/workflows/                ◄── DUEÑO: Claude Code
├── CLAUDE.md                         # instrucciones para Claude Code
├── AGENTS.md                         # instrucciones para OpenCode
└── turbo.json · pnpm-workspace.yaml
```

**Reglas de dependencia (verificadas por lint):**
- `apps/web` **no** importa de `apps/api` ni de `packages/db`. Nunca. Solo de `packages/contracts` y `packages/ui`.
- `apps/api` no importa de `apps/web`.
- `packages/contracts` no importa de nadie (sin dependencias más allá de Zod).
- Ninguna app importa Prisma directamente salvo `apps/api`.

---

## V. ESTRATEGIA CLAUDE CODE + OPENCODE

Esta sección es operativa: define quién toca qué, en qué orden, y cómo se evita el choque.

### V.1 Principio de división: por capa, no por feature

Dividir por feature ("vos hacés clientes, yo hago servicios") suena bien y falla siempre: ambos agentes terminan tocando schema, contratos, backend y frontend de su feature, y colisionan en los archivos compartidos.

Dividir por capa funciona porque **el punto de contacto es un único artefacto versionado: `packages/contracts`**.

| | **Claude Code** | **OpenCode** |
|---|---|---|
| **Dominio** | Todo lo que corre en el servidor y en la base | Todo lo que corre en el navegador |
| **Directorios que escribe** | `apps/api/**`, `packages/db/**`, `packages/contracts/**`, `.github/**` | `apps/web/**`, `packages/ui/**` |
| **Responsabilidades** | Schema y migraciones · contratos Zod · endpoints · reglas de negocio · máquinas de estado · guards y RBAC · multi-tenancy · auditoría · jobs · integraciones (Storage, Supabase, email) · generación de PDF · tests de integración y e2e de API · CI/CD | Design system · layouts y navegación · todas las pantallas admin · toda la PWA de campo · service worker · motor offline (Dexie + outbox + sync) · formularios y validación con los schemas de contracts · TanStack Query · accesibilidad y performance de frontend · tests de componente y e2e de UI |
| **Lee pero no escribe** | `apps/web/**` (para entender el consumo) | `packages/contracts/**`, `apps/api/**` (para entender la API) |

### V.2 El contrato es la ley

```
packages/contracts  ──►  validación en NestJS (ZodValidationPipe)
                    ──►  tipos de TS para ambos lados (z.infer)
                    ──►  cliente tipado en apps/web/lib/api  [GENERADO]
                    ──►  handlers de MSW para desarrollo y tests  [GENERADO]
                    ──►  docs/api/openapi.json  [GENERADO]
```

Reglas duras:

1. **OpenCode nunca define un tipo de la API.** Si necesita un campo que no existe, abre un issue con label `contract-change`; no lo inventa localmente.
2. **Claude Code nunca cambia un contrato sin PR propio.** Un cambio de contrato es un PR solo, con su entrada de changelog. Nunca mezclado con implementación.
3. **Cambio de contrato = versión menor de `@fumibug/contracts`.** Breaking change = PR con label `breaking` que exige aprobación humana explícita.
4. **Los mocks de MSW se generan de los contratos.** OpenCode desarrolla contra mocks desde el minuto cero y **nunca queda bloqueado esperando al backend**. Esto es lo que hace posible el paralelismo real.

### V.3 Secuencia: qué es paralelo y qué no

**Estrictamente secuencial (Fase 0, Claude Code solo, OpenCode no arranca hasta que termine):**
1. Schema de Prisma + migraciones + seeds
2. `packages/contracts` con los schemas base y el catálogo de errores
3. Auth, guards, tenant context, extensión de Prisma, interceptor de auditoría
4. Generador de cliente API + generador de mocks MSW
5. CI verde

**Paralelo (Fase 1 en adelante):** para cada módulo, Claude Code publica primero el contrato (PR chico, se mergea rápido); a partir de ahí ambos trabajan en simultáneo — Claude Code implementa el endpoint real, OpenCode construye la pantalla contra el mock. Se encuentran cuando ambos mergearon.

```
Contrato ──► [ Claude Code: endpoint + tests ]  ──┐
   │                                              ├──► integración ──► e2e
   └───────► [ OpenCode: pantalla contra MSW ]  ──┘
```

**Secuencial dentro de un módulo:** contrato antes que implementación · migración antes que endpoint · design system antes que pantallas · motor offline antes que pantallas de campo.

### V.4 Cómo se evita el conflicto

**Tabla de propiedad de archivos compartidos** — se copia tal cual a `CLAUDE.md` y `AGENTS.md`:

| Archivo | Dueño | Regla |
|---|---|---|
| `packages/db/prisma/schema.prisma` | Claude Code | OpenCode **nunca** lo toca |
| `packages/contracts/**` | Claude Code | OpenCode lo consume; pide cambios por issue |
| `packages/ui/**` | OpenCode | Claude Code no lo toca |
| `apps/web/lib/api/**` | **Generado** | Nadie lo edita a mano. Regenerar |
| `pnpm-lock.yaml` | Ambos | Cada agente agrega deps **solo** al `package.json` de sus apps. Conflicto → regenerar, no mergear a mano |
| `packages/config/**` | Humano | PR explícito, aprobación humana |
| `.env.example` | Ambos, append-only | Solo se agregan líneas, nunca se reordena el archivo |
| `turbo.json`, `pnpm-workspace.yaml` | Humano | |
| `docs/MASTER_SPEC.md` | Humano | Los agentes proponen cambios por issue |
| `.github/workflows/**` | Claude Code | |

**Reglas de proceso:**
- **Un PR nunca cruza la frontera.** Si toca `apps/api` y `apps/web`, se parte en dos. Esta regla sola elimina la mayoría de los conflictos.
- **Ramas cortas.** Máximo 2 días de vida. Rebase diario sobre `develop`.
- **Un issue = un PR = una rama.**
- **Nadie hace commits directos a `main` ni a `develop`.** Protección de rama activa.

### V.5 Git

```
main       ── producción. Protegida. Solo merge desde release/*
develop    ── integración. Protegida. Solo merge por PR con CI verde
  ├── feat/api/<issue>-<slug>      ← Claude Code
  ├── feat/web/<issue>-<slug>      ← OpenCode
  ├── feat/contracts/<issue>-<slug>← Claude Code, PR aislado
  ├── fix/... · chore/... · docs/adr/...
  └── release/vX.Y.Z
```

Commits en Conventional Commits con scope obligatorio:
`feat(api/routes): publicación atómica de ruta` · `feat(web/field): pantalla de ejecución` · `feat(contracts): schemas de inventario`

El scope define el dueño. Un commit con scope `api` en una rama `feat/web/*` es un error de proceso y el CI lo rechaza.

### V.6 Code review

```
PR abierto
   │
   ├─► CI automático (BLOQUEANTE, corre antes de que nadie mire)
   │     lint · typecheck · unit · integración · migración en DB efímera
   │     test de aislamiento cross-tenant · presupuesto de bundle · build
   │
   ├─► Review cruzado entre agentes
   │     Claude Code revisa PRs de web: ¿usa bien los contratos? ¿maneja
   │       los códigos de error? ¿asume campos que no existen?
   │     OpenCode revisa PRs de api: ¿la respuesta sirve para la UI?
   │       ¿falta un campo? ¿la paginación es usable?
   │
   ├─► Review humano (obligatorio, no simbólico)
   │     Foco en: reglas de negocio de §I, seguridad, dinero, estados
   │
   └─► Merge squash a develop
```

**Tests antes que review** — no al revés. Revisar código que no compila es tiempo tirado, y era el error de orden en tu diagrama original.

**Checklist obligatorio del PR** (plantilla en `.github/pull_request_template.md`):
- [ ] Referencia el issue y la sección del MASTER_SPEC que implementa
- [ ] No toca archivos de los que no es dueño
- [ ] Las reglas de negocio afectadas tienen test que las nombra (`R14`, `R24`...)
- [ ] Si toca contratos, es un PR aislado con changelog
- [ ] Si toca dinero, inventario o estados: hay test de concurrencia
- [ ] Si agrega endpoint: agregado al test de aislamiento cross-tenant
- [ ] Si agrega variable de entorno: está en `.env.example` y documentada
- [ ] Si cambia una decisión arquitectónica: hay ADR

### V.7 Documentación de decisiones (ADR)

`/docs/adr/NNNN-titulo.md`, formato: Contexto · Decisión · Alternativas consideradas · Consecuencias · Estado.

ADRs iniciales obligatorios, escritos en Fase 0:
- `0001` Monorepo Turborepo y división por capas
- `0002` NestJS separado en lugar de API routes de Next
- `0003` Supabase Auth como IdP, NestJS como authorization server
- `0004` Aislamiento multi-tenant en tres capas
- `0005` Contratos Zod como fuente única de verdad
- `0006` Offline asimétrico con outbox e idempotencia
- `0007` Dinero en centavos enteros y libros append-only
- `0008` Una sola app Next con route groups admin/campo

**Regla:** si un agente quiere desviarse del MASTER_SPEC, escribe un ADR y lo propone. No cambia el código y explica después.

### V.8 Gestión de tareas

GitHub Issues con labels: `agent:claude-code` · `agent:opencode` · `phase:0..4` · `module:*` · `blocked-by:#N` · `contract-change` · `breaking` · `needs-human`.

Plantilla de issue: qué construir · sección del MASTER_SPEC · criterios de aceptación (copiados de §W) · dependencias · dueño.

Cada issue nace con criterios de aceptación **verificables**. Un issue sin criterios no se asigna.

### V.9 Validación de cambios — pipeline de CI

```yaml
# En cada PR (bloqueante):
  lint · typecheck (strict, cero `any`)
  test:unit
  test:integration        # Postgres efímero + migraciones desde cero
  test:tenant-isolation   # BLOQUEANTE, sin excepciones
  test:business-rules     # cada regla de §I con su ID
  build (api + web)
  bundle-budget           # falla si /campo supera 200 KB gz
  migration-check         # detecta drift entre schema y migraciones

# En merge a develop:
  deploy a staging (Railway preview + Vercel preview)
  test:e2e contra staging (Playwright: flujo admin completo + flujo operario completo)
  seed de datos de demo

# En merge a main:
  migración de producción (con backup previo automático)
  deploy
  smoke tests
  notificación
```

### V.10 Lo primero que hay que escribir

Antes de una sola línea de código de negocio:

1. `docs/MASTER_SPEC.md` — este documento, aprobado.
2. `CLAUDE.md` — dominio, comandos, propiedad de archivos, convenciones, prohibiciones, dónde está el spec.
3. `AGENTS.md` — lo mismo desde la perspectiva de OpenCode, con la lista explícita de lo que no debe tocar.
4. Los 8 ADRs iniciales.
5. `.github/pull_request_template.md` con el checklist de §V.6.
6. Los issues de Fase 0 y Fase 1 completos, con criterios de aceptación.

Esa preparación cuesta entre uno y dos días y es la diferencia entre dos agentes que colaboran y dos agentes que producen dos sistemas incompatibles que hay que reconciliar a mano.

---
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

## X. RIESGOS

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|:--:|:--:|---|
| 1 | **El operario no usa la app** y vuelve al cuaderno | Alta | Crítico | Un operario en el diseño desde la semana 1. Prototipo en su celular real en Fase 1. Menos de 2 minutos de registro por servicio, medido. Offline real. Si la app no le ahorra tiempo, no la va a usar por más orden que le dé el dueño. |
| 2 | **La sincronización offline duplica datos** (pagos, consumo) | Media | Crítico | Idempotencia por `client_event_id` con constraint única en DB desde el primer commit. Suite de tests que simula pérdida de red, reintentos y duplicados. Es la clase de bug que destruye la confianza en el sistema. |
| 3 | **Fuga de datos entre tenants** | Baja | Crítico | Tres capas (§K.4) + test bloqueante en CI. |
| 4 | **La caja no cierra** y el sistema pierde credibilidad financiera | Media | Alto | Libro append-only, esperado calculado, transacciones atómicas, saldo cero obligatorio, centavos enteros. |
| 5 | **Los certificados salen mal** (dato equivocado, numeración con huecos) | Media | Crítico | Snapshot al emitir, numeración con bloqueo, validación de completitud, inmutabilidad tras firma. Un certificado mal emitido es un problema legal, no un bug. |
| 6 | **Los dos agentes divergen** y producen código incompatible | Alta | Alto | Contratos como fuente única, división por capas, PRs que no cruzan la frontera, mocks generados, review cruzado, CI bloqueante. Es el riesgo más probable de todos. |
| 7 | **Sobreingeniería**: se construye el SaaS antes de que funcione el producto | Alta | Alto | Roadmap con criterios de salida. Nada de billing hasta el segundo cliente pagando. Esta especificación es larga justamente para que el alcance no se estire por improvisación. |
| 8 | **Costos de Google Maps se disparan** | Media | Medio | Geocoding persistido, sin Distance Matrix en MVP, navegación por links, límite de gasto en la consola desde el día 1. |
| 9 | El GPS resulta inútil en la práctica (imprecisión, permisos denegados) | Media | Medio | Ya está tratado como evidencia y no como control. Nada del flujo depende de él. |
| 10 | **Fotos que consumen storage y ancho de banda sin control** | Alta | Medio | Compresión a WebP <300 KB, límite por servicio, lifecycle a storage frío a 24 meses, monitoreo de costo mensual. |
| 11 | Supabase cambia precios o límites | Baja | Alto | Postgres estándar y Storage compatible con S3: la migración a Neon + R2 es factible. **Ningún uso de funciones propietarias de Supabase fuera de Auth y Storage.** |
| 12 | Un solo desarrollador/orquestador humano se convierte en cuello de botella | Alta | Medio | Criterios de aceptación explícitos, CI que valida sin intervención, review cruzado entre agentes que filtra antes del humano. |
| 13 | El alcance crece durante el desarrollo ("ya que estamos...") | Alta | Alto | Todo cambio de alcance es un issue con label `needs-human` y actualización del MASTER_SPEC. Nada entra por conversación. |
| 14 | Datos legacy de Fumibug mal migrados | Media | Medio | Import CSV con validación, dry-run, reporte de errores por fila, y período de convivencia con el sistema viejo. |
| 15 | Pérdida de datos por fallo de infraestructura | Baja | Crítico | PITR + dump diario a bucket externo + **restauración de prueba mensual documentada**. |
| 16 | Conflicto laboral por el registro de ubicación de operarios | Media | Medio | Conversarlo con la empresa **antes** de construir tracking. En MVP solo hay puntos discretos en momentos de trabajo, no seguimiento continuo — y eso es defendible. Documentar la política y comunicarla a los operarios. |
| 17 | El Director Técnico no está disponible para firmar y se traban los certificados | Media | Medio | Firma en lote, notificación diaria de pendientes, posibilidad de más de un DT por tenant. |
| 18 | Celulares viejos que no soportan la PWA | Media | Medio | Objetivo: Android 8+ y Chrome 90+. Probar en un dispositivo de gama baja real, no solo en el emulador. Presupuesto de bundle en CI. |

---
## Y. RECOMENDACIÓN FINAL

### Y.1 Qué cambiaría de tu planteo original

1. **La máquina de estados.** Tres ciclos de vida (`service`, `route_stop`, `service_session`), no uno. Sin esto, la reprogramación y los intentos fallidos de visita no se pueden modelar.
2. **Agregar contratos recurrentes al MVP.** Es la mayor omisión funcional. Sin recurrencia, el admin carga a mano el 70% de los servicios del mes y el sistema le genera trabajo en lugar de ahorrárselo.
3. **Agregar certificados sanitarios al MVP.** Es la mayor omisión de valor. Es el único módulo que un competidor genérico no tiene y el que justifica que la empresa pague.
4. **Rediseñar el inventario** con stock por vehículo, lotes y dilución. Como estaba planteado, el stock nunca iba a cerrar.
5. **Definir la autenticación con precisión** en vez de "Supabase Auth o JWT". Y resolver el problema real: los operarios no tienen email.
6. **No confiar en RLS sola.** Como se iba a usar, no protegía nada.
7. **Una sola app Next.js**, no dos.
8. **Tests antes del review**, no después. Tu diagrama tenía el orden invertido.
9. **Agregar firma del cliente**, que no estaba en la lista y es evidencia central.
10. **Precios versionados por vigencia.** Con la inflación local, sin esto no podés reconstruir cuánto valía un servicio hace tres meses.

### Y.2 Qué NO desarrollaría todavía

Tracking en tiempo real (imposible en PWA) · optimización automática de rutas (sin datos, empeora la planificación) · facturación ARCA (proyecto propio, se integra) · WhatsApp Business API (el `wa.me` manual da el 80% del valor) · billing y planes (no hay segundo cliente) · offline en el admin (complejidad sin retorno) · app nativa (la PWA alcanza) · portal del cliente (Fase 2) · estaciones de monitoreo (Fase 2, pero **modelar el schema ahora**) · modo oscuro · multi-idioma · microservicios (probablemente nunca).

### Y.3 Qué es imprescindible para el MVP

El corte mínimo con el que Fumibug abandona el Excel:

```
Auth + roles → Clientes/ubicaciones → Servicios + contratos recurrentes
→ Planificador + rutas + publicación → App de campo OFFLINE con evidencia
→ Inventario con lotes y dilución → Pagos + caja + rendición
→ CERTIFICADOS → Validación de cierres → 8 reportes → Auditoría
```

Si hubiera que recortar más: los reportes se pueden reducir a 4 y el dashboard a 4 números. **Lo que no se recorta nunca es offline ni certificados.** Sin offline, el operario no la usa. Sin certificados, la empresa no cambia de sistema.

### Y.4 Arquitectura definitiva

```
Monorepo Turborepo + pnpm

Frontend    Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind
            shadcn/ui sobre packages/ui · TanStack Query (estado servidor)
            Zustand (solo UI) · React Hook Form + Zod · Dexie (offline)
            Workbox scopeado a /campo · @dnd-kit · @vis.gl/react-google-maps

Backend     NestJS · TypeScript strict · Prisma · Zod (contratos compartidos)
            Guards JWT/Tenant/Permission · interceptor de auditoría
            @nestjs/schedule para jobs · Puppeteer o pdf-lib para certificados

Datos       PostgreSQL (Supabase) · RLS + extensión Prisma de tenant
            Supabase Storage privado con URLs firmadas
            Supabase Auth como IdP · PgBouncer transaction mode

Deploy      Vercel (web) · Railway (api) · GitHub Actions
            Sentry + logs JSON estructurados desde el día 1

Después     Redis/Upstash + BullMQ cuando haya 2ª instancia o PDFs lentos
```

**Confirmo tu stack propuesto**, con estas precisiones: monorepo (no repos separados), una sola app Next, Prisma como ORM, Supabase usado solo como Postgres + Auth + Storage (nunca como API de datos desde el frontend), y Zod compartido como columna vertebral del contrato.

### Y.5 Qué va a dar problemas durante el desarrollo

En orden de probabilidad:

1. **El motor de sincronización offline.** Es la parte más difícil del sistema. Idempotencia, orden causal, fotos grandes, reintentos, conflictos. Se construye **temprano** y con tests exhaustivos, no al final como "agregar offline".
2. **El planificador drag & drop.** Estado optimista, rollback, autosave, conflictos de versión, virtualización. Es donde más se sufre en frontend.
3. **La coordinación entre agentes.** Ver §X.6.
4. **La transaccionalidad de dinero e inventario.** Fácil de escribir mal, difícil de detectar hasta que los números no cierran.
5. **Numeración correlativa de certificados bajo concurrencia.** El error clásico (`MAX(number)+1`) produce huecos o duplicados con dos emisiones simultáneas.
6. **Performance del planificador y de "Hoy"** con volumen real.
7. **La generación de PDF.** Puppeteer en Railway consume memoria; hay que dimensionarlo o usar `pdf-lib`.
8. **Las fotos.** Compresión en Android viejo, orientación EXIF, memoria, subida en 3G.

### Y.6 Qué hacer primero

**Semana 1, en este orden estricto:**

1. Aprobar este documento. Fumibug lo revisa y confirma sobre todo §C.21 (certificados), §C.5 (contratos) y §O (caja). **Un error acá cuesta semanas después.**
2. Conseguir muestras reales: 3 certificados actuales, la lista de insumos con sus registros ANMAT/SENASA, la lista de precios vigente, 10 clientes con sus datos, y una ruta típica de un día. Sin datos reales, el diseño se hace sobre suposiciones.
3. **Pasar medio día en la camioneta con un operario.** No es opcional. Todo lo que asumiste sobre cómo trabaja va a estar parcialmente mal, y es más barato descubrirlo ahora.
4. Montar el repo con la estructura de §U, `CLAUDE.md`, `AGENTS.md` y los 8 ADRs.
5. Claude Code ejecuta Fase 0 solo, hasta CI verde.
6. Recién ahí entra OpenCode.

### Y.7 Cómo preparar el proyecto para Claude Code + OpenCode

Checklist ejecutable:

```
[ ] Monorepo creado con la estructura de §U
[ ] docs/MASTER_SPEC.md commiteado y aprobado
[ ] CLAUDE.md   → dominio, comandos, archivos propios, prohibiciones, link al spec
[ ] AGENTS.md   → lo mismo para OpenCode, con la lista de lo que NO toca
[ ] docs/adr/0001..0008 escritos
[ ] .github/pull_request_template.md con el checklist de §V.6
[ ] Protección de rama en main y develop: sin push directo, CI obligatorio, 1 aprobación
[ ] CODEOWNERS marcando propiedad por directorio
[ ] CI configurado con los 8 jobs de §V.9
[ ] Issues de Fase 0 y Fase 1 creados con criterios de aceptación de §W
[ ] Labels: agent:* · phase:* · module:* · contract-change · breaking · needs-human
[ ] packages/contracts inicializado con los enums y el catálogo de errores
[ ] Generadores de cliente API y de mocks MSW funcionando
[ ] .env.example completo, sin un solo valor real
[ ] Supabase de desarrollo y de staging creados
[ ] Límite de gasto configurado en Google Cloud
```

**Las tres reglas que le tienen que quedar clarísimas a los dos agentes:**

1. **El MASTER_SPEC manda.** Desviarse requiere un ADR aprobado, no una decisión sobre la marcha.
2. **Cada uno toca solo sus archivos.** Un PR que cruza la frontera se rechaza sin discusión.
3. **El contrato se cambia en un PR aislado, nunca junto con implementación.**

---

# MASTER DEVELOPMENT SPECIFICATION

*Síntesis operativa. Esto es lo que se entrega directo a Claude Code y OpenCode.*

## 1. Proyecto
Fumibug — plataforma de Field Service Management para control de plagas, con certificación sanitaria argentina, control de inventario en vehículo y caja por operario. Multi-tenant desde el día 1, monoempresa en producción hasta Fase 4.

## 2. Stack (cerrado, no se discute sin ADR)
Monorepo Turborepo + pnpm · Next.js 15 App Router / React 19 / TS strict / Tailwind / shadcn · NestJS / Prisma / PostgreSQL (Supabase) · Supabase Auth + Storage · Zod compartido · Vercel + Railway + GitHub Actions · Sentry.

## 3. Estructura
Según §U. `apps/api` y `packages/{db,contracts}` son de Claude Code. `apps/web` y `packages/ui` son de OpenCode. `packages/config` es del humano.

## 4. Entidades centrales
`tenants` `users` `memberships` `roles` `permissions` `customers` `service_locations` `service_contracts` `services` `routes` `route_stops` `service_sessions` `service_evidence` `supplies` `supply_lots` `stock_locations` `inventory` `inventory_movements` `service_supply_usage` `payments` `cash_accounts` `cash_movements` `cash_closures` `certificates` `price_lists` `audit_logs` `sync_events` `notifications`.

Detalle completo de campos, índices y constraints en §H. **No se agrega ni se quita una tabla sin ADR.**

## 5. Estados
- `service`: DRAFT · SCHEDULED · ASSIGNED · DISPATCHED · IN_EXECUTION · PENDING_VALIDATION · COMPLETED · PARTIALLY_COMPLETED · RESCHEDULED · CANCELLED
- `route`: DRAFT · READY · PUBLISHED · IN_PROGRESS · COMPLETED · CANCELLED
- `route_stop`: PENDING · EN_ROUTE · ARRIVED · IN_PROGRESS · DONE · NO_SHOW · INACCESSIBLE · SKIPPED · CANCELLED
- `service_session`: OPEN · CLOSED
- `cash_closure`: OPEN · DECLARED · RECONCILED · DISPUTED
- `certificate`: DRAFT · ISSUED · SIGNED · VOIDED

Transiciones y guardas en §D. **Toda transición pasa por `StateMachineService` con `SELECT FOR UPDATE`.**

## 6. Invariantes del sistema (nunca se violan)
1. Toda query de negocio lleva `tenant_id`, inyectado por extensión de Prisma y respaldado por RLS.
2. `audit_logs`, `cash_movements` e `inventory_movements` son append-only con trigger que rechaza UPDATE/DELETE.
3. Todo el dinero es `BIGINT` en centavos, en todo el stack.
4. Pago en efectivo y movimiento de caja nacen en la misma transacción.
5. Consumo de insumo y movimiento de inventario nacen en la misma transacción.
6. Una sesión abierta por operario (índice único parcial).
7. Una ruta por operario por día (índice único parcial).
8. Toda acción originada en el campo lleva `client_event_id` y es idempotente.
9. Publicar ruta es atómico o no ocurre.
10. Un certificado firmado es inmutable.
11. El GPS nunca bloquea una acción.
12. Recursos de otro tenant devuelven `404`, no `403`.

## 7. Contrato
`packages/contracts` con Zod es la única fuente de verdad de tipos. De ahí se generan: validación en NestJS, tipos de ambos lados, cliente API, mocks MSW y OpenAPI. **OpenCode nunca define un tipo de API. Claude Code nunca mezcla cambio de contrato con implementación.**

## 8. API
REST versionada en `/v1`. Formato de respuesta y códigos de error en §J.1. `tenant_id` siempre del JWT. `Idempotency-Key` en mutaciones de campo. `If-Match` en entidades versionadas. Endpoints en §J.2.

## 9. Frontend
Una app Next. Route group `(admin)` desktop sin service worker; route group `(campo)` PWA con SW scopeado. Tokens de diseño en `packages/ui/tokens.css`. Touch target 56 px y contraste 7:1 en campo. Presupuesto de bundle en `/campo`: **200 KB gz, verificado en CI**. Estados de loading, error y empty obligatorios en todo componente que consuma datos.

## 10. Offline
Lectura cacheada + escritura encolada. Dexie + outbox + SyncEngine con orden causal, backoff exponencial e idempotencia por `client_event_id`. Solo `/campo`. Detalle en §L.

## 11. Seguridad
Supabase Auth (IdP) + NestJS (authz). Aislamiento en 3 capas. Zod en todo borde. Rate limiting por endpoint. Uploads por URL firmada a bucket privado con path definido por el servidor. Auditoría transaccional. Detalle en §K.

## 12. División de trabajo
| Claude Code | OpenCode |
|---|---|
| `apps/api/**` · `packages/db/**` · `packages/contracts/**` · `.github/**` | `apps/web/**` · `packages/ui/**` |
| Schema, migraciones, contratos, endpoints, reglas, estados, RBAC, tenancy, auditoría, jobs, PDF, tests de API, CI | Design system, pantallas admin, PWA de campo, service worker, motor offline, formularios, queries, a11y, performance, tests de UI |

**Un PR nunca cruza la frontera.** Ramas `feat/api/*`, `feat/web/*`, `feat/contracts/*`. Commits convencionales con scope.

## 13. Flujo de trabajo
`Issue → rama → PR → CI bloqueante → review cruzado entre agentes → review humano → squash a develop`. CI: lint · typecheck · unit · integración · **aislamiento cross-tenant** · reglas de negocio · build · presupuesto de bundle · drift de migraciones.

## 14. Orden de construcción
```
FASE 0  Claude Code solo. Monorepo, schema, contratos, auth, tenancy,
        auditoría, generadores, CI verde, deploys vacíos.
        → Salida: endpoint dummy autenticado y auditado consumido desde el front deployado.

FASE 1  Ambos en paralelo. Usuarios, clientes, ubicaciones, servicios,
        contratos, planificador, rutas, app de campo con offline, evidencia,
        validación de cierres, dashboard, auditoría.
        → Salida: un operario real trabaja un día completo sin cuaderno.

FASE 2  Inventario, pagos, caja, rendiciones, CERTIFICADOS, reportes, push.
        → Salida: Fumibug deja el Excel.

FASE 3  Producción supervisada, ajuste, performance, seguridad, runbooks.
        → Salida: un mes de operación sin intervención técnica.

FASE 4  Estaciones de monitoreo, onboarding, planes, billing, segundo cliente.
```

**No se arranca una fase sin cerrar el criterio de salida de la anterior.**

## 15. Definition of Done (por PR)
- [ ] Implementa una sección identificada del MASTER_SPEC
- [ ] Solo toca archivos propios
- [ ] Las reglas de negocio afectadas tienen test que las nombra por ID (`R14`, `R24`…)
- [ ] Endpoint nuevo agregado al test de aislamiento cross-tenant
- [ ] Manejo de errores, loading y empty resueltos
- [ ] Sin `any`, sin `console.log`, sin secretos, sin `TODO` sin issue
- [ ] Variables de entorno nuevas en `.env.example`
- [ ] Desvío arquitectónico documentado en un ADR
- [ ] CI en verde antes de pedir review

---

**Fin del documento.**
Cualquier cambio a esta especificación se hace por PR sobre este archivo, con aprobación humana, antes de tocar código.
