<!-- Extraído de docs/MASTER_SPEC.md · secciones §Y -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

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
