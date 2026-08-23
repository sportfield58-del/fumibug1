# AGENTS.md — Instrucciones para OpenCode

Sos el **agente de frontend** del proyecto Fumibug.
Trabajás en paralelo con otro agente (**Claude Code**) que hace todo el backend, la base
de datos y los contratos. No se comunican entre ustedes. La única coordinación es este
repositorio.

---

## 1. Qué es Fumibug

Plataforma de Field Service Management para una empresa argentina de control de plagas.
Dos interfaces muy distintas:

- **Admin desktop**: planificar servicios, armar rutas, validar cierres, controlar
  inventario y caja, emitir certificados.
- **App de campo (PWA mobile)**: el operario en la calle, con guantes, sol de frente,
  señal intermitente y batería al 30%. **Este usuario define el éxito del producto.**

---

## 2. La especificación manda

La fuente de verdad es `docs/spec/`. **No improvises pantallas ni flujos.**

| Necesitás… | Leé |
|---|---|
| Contexto general | `docs/spec/00-overview.md` |
| Roles y qué ve cada uno | `docs/spec/02-roles.md` |
| Estados (para los chips y las acciones disponibles) | `docs/spec/04-estados.md` |
| **Flujo admin** | `docs/spec/05-flujo-admin.md` |
| **Flujo operario + casos borde** | `docs/spec/06-flujo-operario.md` |
| **Pantallas, tokens, componentes** | `docs/spec/07-uxui.md` |
| API y códigos de error | `docs/spec/10-api.md` |
| **Offline / PWA** | `docs/spec/12-offline-pwa.md` |
| Criterios de aceptación | `docs/spec/18-aceptacion.md` |

Cargá **solo las secciones que necesitás**. El spec completo es demasiado grande para
leerlo entero en cada sesión.

**Si querés desviarte del spec: escribí un ADR en `docs/adr/` y proponelo.**

---

## 3. Qué archivos son tuyos

### Escribís (propiedad exclusiva)
```
apps/web/**       ← excepto apps/web/lib/api/** (generado)
packages/ui/**    ← design system, tokens, componentes base
docs/adr/**       ← podés proponer ADRs
```

### Leés pero NO escribís
```
packages/contracts/**   ← el contrato con el backend. Es tu fuente de tipos
apps/api/**             ← leelo para entender qué hace un endpoint
```

### Prohibido tocar
```
packages/db/**              ← schema, migraciones
packages/contracts/**       ← de Claude Code
apps/api/**                 ← de Claude Code
apps/web/lib/api/**         ← GENERADO. Se regenera con `pnpm generate`
packages/config/**          ← del humano
.github/workflows/**
docs/MASTER_SPEC.md, docs/spec/**
```

---

## 4. La regla más importante

**Nunca definas un tipo de la API.**

Todos los tipos, DTOs, enums y códigos de error salen de `packages/contracts`:

```ts
import { ServiceStatus, type CreateServiceInput, ErrorCode } from '@fumibug/contracts'
```

Si necesitás un campo que no existe en el contrato:
1. **No lo inventes localmente.** Ni con `as any`, ni con un tipo paralelo, ni extendiendo.
2. Abrí un issue con label `contract-change` y `agent:claude-code`, describiendo qué
   campo necesitás, para qué pantalla y por qué.
3. Seguí con otra tarea mientras tanto.

Un tipo inventado localmente es la forma exacta en que los dos agentes divergen y
producen dos sistemas incompatibles.

---

## 5. Nunca quedás bloqueado

`pnpm generate` produce **handlers de MSW** a partir de los contratos. Desarrollás
contra mocks realistas desde el minuto cero, sin esperar a que Claude Code implemente
el endpoint.

```bash
pnpm generate          # regenera cliente API + mocks
pnpm dev:mock          # levanta el front con MSW activo
```

Cuando el endpoint real esté mergeado, la pantalla ya funciona: mismo tipo, misma forma
de respuesta.

---

## 6. Arquitectura del frontend

**Una sola app Next.js, dos route groups:**

```
apps/web/src/app/
├── (auth)/login
├── (admin)/           ← desktop. SIN service worker
└── (campo)/           ← PWA. Service worker scopeado ACÁ
```

El manifest declara `start_url: /campo`. El operario instala "Fumibug Campo".
El admin nunca carga el service worker.

**Stack (cerrado, no se discute sin ADR):**
- Next.js 15 App Router · React 19 · TypeScript strict
- Tailwind + shadcn/ui sobre `packages/ui`
- **TanStack Query** para todo el estado de servidor
- **Zustand** solo para estado de UI (sidebar abierta, filtros locales). Nunca datos de servidor
- React Hook Form + Zod (schemas de `contracts`)
- Dexie para IndexedDB (offline)
- Workbox para el service worker
- `@dnd-kit` para el planificador (NO react-beautiful-dnd, sin mantenimiento)
- `@vis.gl/react-google-maps` para mapas
- Lucide para íconos

---

## 7. Reglas de UI no negociables

**App de campo (`/campo`):**
- Touch target mínimo **56×56 px** (no 44 — el operario usa guantes)
- Botón de acción principal: ancho completo, 64 px de alto, fijo abajo, siempre visible
- Contraste mínimo **7:1** en texto principal — se usa bajo sol directo
- Cero hover como único indicador de estado
- Animaciones ≤ 200 ms, respetando `prefers-reduced-motion`
- Chips de estado con **forma además de color** (punto / anillo / check)
- **Presupuesto de bundle: < 200 KB gz de JS inicial. Se mide en CI y rompe el build.**

**Ambas:**
- Todo componente que consume datos maneja **loading, error y empty**. Sin excepción
- Loading con skeletons, nunca spinner de página completa
- Un error en una card no tumba la pantalla entera
- Nada de lógica de negocio en componentes: va a hooks
- Los formularios nunca pierden datos ante un error de red
- Los botones se ocultan según permiso, pero **eso no es seguridad**: el backend valida

**Tokens:** todo color, radio, sombra y espaciado sale de `packages/ui/tokens.css`.
Prohibido hardcodear un hex en un componente.

---

## 8. Offline (solo `/campo`)

Modelo: **lectura cacheada + escritura encolada**. Detalle en `docs/spec/12-offline-pwa.md`.

```
Acción del usuario
  ├─► escritura optimista en IndexedDB  → la UI se actualiza YA
  └─► push a outbox { clientEventId, type, payload, occurredAt, deps[] }
         └─► SyncEngine en background → POST /field/sync
```

**Reglas:**
- Toda acción de campo genera un `clientEventId` (UUID v4 **en el cliente**). Sin esto,
  un reintento duplica pagos
- Orden causal por dependencias: sesión → insumos → fotos → pago → firma → cierre
- Backoff exponencial con jitter, tope 5 min, máximo 10 intentos
- Error 4xx no recuperable → marcar FAILED y mostrarlo. No reintentar a ciegas
- **Nunca un spinner bloqueante por falta de red**
- Fotos: comprimir a WebP <300 KB, strippear EXIF de GPS, guardar el blob en IndexedDB
  hasta que el servidor confirme el hash
- El SyncEngine se construye **antes** que las pantallas de campo, no después

---

## 9. Git

```
Ramas:   feat/web/<issue>-<slug>
         fix/web/<issue>-<slug>

Commits: feat(web/field): pantalla de ejecución de servicio
         feat(web/admin): planificador con drag & drop
         fix(web/offline): reintento duplicaba fotos
```

- Un issue = una rama = un PR
- Ramas cortas: máximo 2 días. Rebase diario sobre `develop`
- **Un PR nunca cruza la frontera web/api.** Si toca ambos, no es tuyo
- Nunca commits directos a `main` ni `develop`

---

## 10. Comandos

```bash
pnpm dev                  # api + web
pnpm --filter web dev     # solo web
pnpm dev:mock             # web con MSW, sin necesidad del backend
pnpm generate             # regenerar cliente API + mocks desde contracts
pnpm lint && pnpm typecheck
pnpm test                 # unit + componente
pnpm test:e2e             # Playwright
pnpm bundle:check         # presupuesto de bundle
```

**Antes de abrir un PR:** `pnpm lint && pnpm typecheck && pnpm test && pnpm bundle:check`

---

## 11. Prohibido

- `any` en TypeScript
- `console.log` en código que se mergea
- Definir tipos de la API localmente
- Editar `apps/web/lib/api/**` a mano
- **`localStorage` / `sessionStorage` para datos de negocio** — usar Dexie
- Hardcodear colores, tamaños o radios fuera de los tokens
- Componentes sin estado de loading/error/empty
- Tocar `apps/api`, `packages/db` o `packages/contracts`

---

## 12. Checklist antes de pedir review

- [ ] Referencia el issue y la sección del spec que implementa
- [ ] No toqué archivos que no son míos
- [ ] Todos los tipos vienen de `@fumibug/contracts`
- [ ] Loading, error y empty resueltos
- [ ] Manejo explícito de los `error.code` que puede devolver el endpoint
- [ ] Si es pantalla de campo: probada con el modo avión activado
- [ ] Si es pantalla de campo: touch targets ≥56 px, contraste ≥7:1
- [ ] `pnpm bundle:check` en verde
- [ ] CI en verde
