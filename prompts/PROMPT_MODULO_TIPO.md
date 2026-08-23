# PROMPTS DE MÓDULO (plantillas reutilizables)

Durante la Fase 1 y 2, cada módulo se construye con la misma secuencia de tres prompts.
Reemplazá `{MÓDULO}` y `{SECCIÓN}` y usalos tal cual.

---

## Paso 1 — Contrato (Claude Code, PR aislado)

```
Vamos con el módulo {MÓDULO}.

Primer paso, y va en un PR solo: definí el contrato en packages/contracts.

Leé docs/spec/{SECCIÓN}.md y docs/spec/10-api.md.

Necesito:
- Schemas Zod de request y response de cada endpoint del módulo
- Los ErrorCode específicos que puede devolver
- Los tipos de filtro y paginación de las listas
- Nada de implementación

Rama: feat/contracts/{issue}-{módulo}
Cuando termines, corré pnpm generate y verificá que el cliente y los mocks se generan bien.

Mostrame el diff antes de mergear. Este PR desbloquea a OpenCode, así que quiero
revisarlo con atención.
```

---

## Paso 2 — Backend (Claude Code) y Frontend (OpenCode), en paralelo

**A Claude Code:**
```
El contrato de {MÓDULO} ya está mergeado. Implementá el backend.

Leé docs/spec/{SECCIÓN}.md, docs/spec/09-reglas.md y docs/spec/18-aceptacion.md.

Requisitos:
- Módulo NestJS feature-based en apps/api/src/modules/{módulo}
- Todos los endpoints del contrato, con guards y permisos correctos
- Las reglas de negocio de §I que apliquen, cada una con un test que la nombra por ID
- Transiciones de estado vía StateMachineService, nunca asignación directa
- Si toca dinero o inventario: todo en una transacción, con test de concurrencia
- Los endpoints nuevos agregados a test/tenant-isolation.e2e.ts
- Paginación en toda lista, select explícito en Prisma

Rama: feat/api/{issue}-{módulo}
```

**A OpenCode (en simultáneo, otro worktree):**
```
El contrato de {MÓDULO} ya está mergeado. Corré pnpm generate y construí las pantallas.

Leé docs/spec/07-uxui.md (pantallas {IDs}) y docs/spec/{SECCIÓN}.md.

Requisitos:
- Todos los tipos desde @fumibug/contracts
- Desarrollá contra MSW (pnpm dev:mock), sin esperar al backend
- Loading, error y empty resueltos
- Manejo explícito de cada ErrorCode que el contrato declara
- Si es pantalla de campo: probada con modo avión

Rama: feat/web/{issue}-{módulo}
```

---

## Paso 3 — Review cruzado

**A Claude Code, sobre el PR de OpenCode:**
```
Revisá este PR de frontend. No lo modifiques: solo señalá problemas.

[pegar el output de: gh pr diff {N}]

Enfocate en:
- ¿Usa los tipos de @fumibug/contracts o inventó alguno?
- ¿Asume campos que la API no devuelve?
- ¿Maneja los ErrorCode que el endpoint puede devolver?
- ¿Asume comportamiento del backend que no es real?
- ¿Rompe algún invariante de CLAUDE.md?

Devolveme una lista de hallazgos, cada uno marcado como bloqueante o sugerencia.
```

**A OpenCode, sobre el PR de Claude Code:**
```
Revisá este PR de backend desde la perspectiva de quien consume la API.
No lo modifiques: solo señalá problemas.

[pegar el output de: gh pr diff {N}]

Enfocate en:
- ¿La respuesta tiene todo lo que la pantalla necesita, o me va a obligar a hacer N+1 requests?
- ¿Falta algún campo para renderizar la vista?
- ¿La paginación es usable desde la UI?
- ¿Los mensajes de error se pueden mostrar al usuario tal cual?
- ¿Coincide con lo que declara el contrato?

Devolveme una lista de hallazgos, cada uno marcado como bloqueante o sugerencia.
```
