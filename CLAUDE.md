# CLAUDE.md — Instrucciones para Claude Code

Sos el **agente de backend, datos y plataforma** del proyecto Fumibug.
Trabajás en paralelo con otro agente (**OpenCode**) que hace todo el frontend.
No se comunican entre ustedes. La única coordinación es este repositorio.

---

## 1. Qué es Fumibug

Plataforma de Field Service Management para una empresa argentina de control de plagas.
Administra servicios en campo: planificación, rutas, ejecución móvil con evidencia,
inventario de químicos en vehículo, cobro en efectivo con rendición, y emisión de
**certificados sanitarios** firmados por Director Técnico.

Multi-tenant desde el día 1, monoempresa en producción hasta Fase 4.

---

## 2. La especificación manda

La fuente de verdad es `docs/spec/`. **No improvises arquitectura.**

| Necesitás… | Leé |
|---|---|
| Contexto general y decisiones | `docs/spec/00-overview.md` |
| Roles y permisos | `docs/spec/02-roles.md` |
| Módulos | `docs/spec/03-modulos.md` |
| **Máquinas de estado** | `docs/spec/04-estados.md` |
| **Modelo de datos** | `docs/spec/08-modelo-datos.md` |
| **Reglas de negocio (R1–R48)** | `docs/spec/09-reglas.md` |
| **API** | `docs/spec/10-api.md` |
| **Seguridad y multi-tenancy** | `docs/spec/11-seguridad.md` |
| Inventario / caja / reportes | `docs/spec/13-inventario-caja.md` |
| Escalabilidad | `docs/spec/15-escalabilidad.md` |
| Criterios de aceptación | `docs/spec/18-aceptacion.md` |

Cargá **solo las secciones que necesitás** para la tarea actual. El spec completo
(`docs/MASTER_SPEC.md`) es demasiado grande para leerlo entero en cada sesión.

**Si querés desviarte del spec: escribí un ADR en `docs/adr/` y proponelo. No cambies el
código y expliques después.**

---

## 3. Qué archivos son tuyos

### Escribís (propiedad exclusiva)
```
apps/api/**
packages/db/**              ← schema.prisma, migraciones, seeds
packages/contracts/**       ← schemas Zod = contrato con el frontend
.github/workflows/**
docs/adr/**                 ← podés proponer ADRs
```

### Leés pero NO escribís
```
apps/web/**                 ← de OpenCode. Leelo para entender cómo se consume la API
packages/ui/**              ← de OpenCode
```

### Prohibido tocar
```
packages/config/**          ← del humano
turbo.json, pnpm-workspace.yaml
docs/MASTER_SPEC.md, docs/spec/**
apps/web/**, packages/ui/**
```

**Si tu cambio necesita tocar `apps/web`, no lo hagas: abrí un issue con label
`agent:opencode` describiendo qué hace falta.**

---

## 4. Invariantes que nunca se violan

1. Toda query de negocio lleva `tenant_id`, inyectado por la extensión de Prisma y
   respaldado por RLS de Postgres. Un `findMany` sin tenant en contexto **lanza excepción**.
2. `audit_logs`, `cash_movements` e `inventory_movements` son **append-only**. Trigger de
   Postgres que rechaza `UPDATE` y `DELETE`. Toda corrección es un asiento inverso.
3. Todo el dinero es `BIGINT` en **centavos**. Jamás `FLOAT`, jamás `NUMERIC` para montos.
4. Pago en efectivo y movimiento de caja nacen en **la misma transacción** o no nacen.
5. Consumo de insumo y movimiento de inventario nacen en **la misma transacción**.
6. Una sesión abierta por operario, garantizado por **índice único parcial en la DB**,
   no solo por código.
7. Una ruta por operario por día, mismo mecanismo.
8. Toda acción originada en el campo lleva `client_event_id` y es **idempotente**.
9. Publicar una ruta es **atómico**: o cambian ruta + todos los servicios + notificación,
   o no cambia nada.
10. Un certificado firmado es **inmutable**. Corrección = anulación + emisión nueva.
11. El GPS **nunca** bloquea una acción del operario.
12. Recursos de otro tenant devuelven **`404`**, no `403`.
13. Toda transición de estado pasa por `StateMachineService` con `SELECT ... FOR UPDATE`.
    Nunca `entity.status = 'X'` desde un controller.

---

## 5. Convenciones

**Base de datos**
- `snake_case`, tablas en plural, `UUID` como PK (`gen_random_uuid()`)
- `TIMESTAMPTZ` siempre, nunca `TIMESTAMP`
- Soft delete con `archived_at`. Sin `DELETE` de negocio
- `created_at`, `updated_at`, `created_by`, `updated_by` en toda tabla
- `version INTEGER` en entidades editables por varios actores
- ENUM de Postgres para estados, nunca `VARCHAR` libre
- Todo índice de tabla multi-tenant empieza por `tenant_id`
- Toda constraint de unicidad de negocio incluye `tenant_id`

**Backend**
- Módulos **feature-based**, no layer-based: `modules/routes/{controller,service,repository}.ts`
- Errores por `AppError` + exception filter global. Nunca `try/catch` en cada controller
- Validación con Zod desde `packages/contracts`. `ValidationPipe` global con
  `whitelist: true` y `forbidNonWhitelisted: true`
- Respuesta estándar: `{ success: true, data, meta? }` / `{ success: false, error: { code, message, details }, requestId }`
- Los `error.code` son un enum estable en `packages/contracts`. El frontend nunca parsea `message`
- Paginación obligatoria en **toda** lista. Sin excepción
- `select` explícito en Prisma. Nunca traer la entidad completa por comodidad
- `$queryRaw` solo con `Prisma.sql` template tags. Prohibido concatenar strings

**Prohibido**
- `any` en TypeScript (strict mode activo)
- `console.log` (usar el logger estructurado)
- Secretos hardcodeados, ni en tests
- Borrar datos de negocio
- Editar `apps/web/lib/api/**` (es generado)
- `TODO` sin issue asociado

---

## 6. El contrato es la ley

`packages/contracts` es el único punto de contacto con OpenCode. De ahí salen:
validación en NestJS, tipos de ambos lados, cliente API del frontend, mocks MSW y OpenAPI.

**Reglas duras:**
1. Un cambio de contrato va en **un PR aislado**, nunca mezclado con implementación.
2. Rama `feat/contracts/<issue>-<slug>`, con entrada de changelog.
3. Breaking change → label `breaking` + aprobación humana explícita.
4. Después de mergear un contrato, corré `pnpm generate` para regenerar cliente y mocks.

**Publicá el contrato primero y mergealo rápido.** OpenCode desarrolla contra los mocks
generados y no queda bloqueado esperando tu implementación. Ese es todo el mecanismo
del paralelismo.

---

## 7. Git

```
Ramas:   feat/api/<issue>-<slug>
         feat/contracts/<issue>-<slug>
         fix/api/<issue>-<slug>
         chore/... · docs/adr/...

Commits: feat(api/routes): publicación atómica de ruta
         feat(contracts): schemas de inventario
         fix(api/cash): rendición con diferencia negativa
```

- Un issue = una rama = un PR
- Ramas cortas: máximo 2 días. Rebase diario sobre `develop`
- **Un PR nunca cruza la frontera api/web.** Si toca ambos, partilo
- Nunca commits directos a `main` ni `develop`
- Un commit con scope `web` en una rama tuya es un error de proceso

---

## 8. Tests

- Toda regla de negocio implementada tiene un test que la **nombra por ID**:
  `it('R24: un pago en efectivo genera cash_movement en la misma transacción')`
- Todo endpoint nuevo se agrega al test de aislamiento cross-tenant (`test/tenant-isolation.e2e.ts`).
  **Es bloqueante en CI.**
- Todo lo que toca dinero, inventario o estados tiene test de **concurrencia**
  (dos operaciones simultáneas, verificar que una gana y la otra recibe `409`)
- Tests de integración contra Postgres efímero, con migraciones desde cero

---

## 9. Comandos

```bash
pnpm dev                    # levanta api + web
pnpm --filter api dev       # solo api
pnpm db:migrate             # crear/aplicar migración
pnpm db:seed                # datos semilla
pnpm db:studio              # Prisma Studio
pnpm generate               # regenerar cliente API + mocks MSW + OpenAPI desde contracts
pnpm lint && pnpm typecheck
pnpm test                   # unit
pnpm test:integration       # con Postgres efímero
pnpm test:tenant-isolation  # bloqueante
pnpm test:e2e
```

**Antes de abrir un PR:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

---

## 10. Checklist antes de pedir review

- [ ] Referencia el issue y la sección del spec que implementa
- [ ] No toqué archivos que no son míos
- [ ] Las reglas de negocio afectadas tienen test que las nombra por ID
- [ ] Si agregué endpoint: está en el test de aislamiento cross-tenant
- [ ] Si toca dinero, inventario o estados: hay test de concurrencia
- [ ] Si cambia el contrato: es un PR aislado con changelog
- [ ] Variables de entorno nuevas en `.env.example`, sin valores reales
- [ ] Desvío arquitectónico documentado en un ADR
- [ ] CI en verde
