<!-- Extraído de docs/MASTER_SPEC.md · secciones §A -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

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
