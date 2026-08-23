<!-- Extraído de docs/MASTER_SPEC.md · secciones §R -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

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
