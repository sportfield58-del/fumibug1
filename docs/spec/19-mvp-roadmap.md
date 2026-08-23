<!-- Extraído de docs/MASTER_SPEC.md · secciones §S, §T -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

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
