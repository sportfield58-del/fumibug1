<!-- Extraído de docs/MASTER_SPEC.md · secciones §V -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

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
