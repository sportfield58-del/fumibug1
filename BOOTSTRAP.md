# BOOTSTRAP — Cómo arrancar Fumibug con dos agentes

Guía operativa. Seguila en orden.

---

## 0. Antes de tocar una tecla

Tres cosas que valen más que cualquier configuración:

1. **Que Fumibug apruebe el spec**, sobre todo las secciones de certificados (§C.21),
   contratos recurrentes (§C.5) y caja (§O). Un error acá cuesta semanas después.
2. **Conseguir datos reales**: 3 certificados que emiten hoy, la lista de insumos con sus
   registros ANMAT/SENASA, la lista de precios vigente, 10 clientes y una ruta típica.
3. **Medio día en la camioneta con un operario.** No es opcional. Todo lo que asumiste
   sobre cómo trabaja va a estar parcialmente mal, y es mucho más barato descubrirlo ahora
   que en la Fase 3.

---

## 1. Partir el spec

`MASTER_SPEC.md` tiene ~24.000 palabras. **No entra cómodamente en cada sesión de un
agente**, y hacer que lo lea entero cada vez desperdicia contexto que necesitás para
el código.

Partilo en `docs/spec/`:

```
docs/
├── MASTER_SPEC.md              ← completo, referencia humana
├── spec/
│   ├── 00-overview.md          ← resumen ejecutivo + visión (§0, §A)
│   ├── 02-roles.md             ← §B
│   ├── 03-modulos.md           ← §C
│   ├── 04-estados.md           ← §D
│   ├── 05-flujo-admin.md       ← §E
│   ├── 06-flujo-operario.md    ← §F
│   ├── 07-uxui.md              ← §G
│   ├── 08-modelo-datos.md      ← §H
│   ├── 09-reglas.md            ← §I
│   ├── 10-api.md               ← §J
│   ├── 11-seguridad.md         ← §K
│   ├── 12-offline-pwa.md       ← §L, §M
│   ├── 13-inventario-caja.md   ← §N, §O, §P
│   ├── 14-saas.md              ← §Q
│   ├── 15-escalabilidad.md     ← §R
│   ├── 16-estructura.md        ← §U
│   ├── 17-agentes.md           ← §V
│   ├── 18-aceptacion.md        ← §W
│   ├── 19-mvp-roadmap.md       ← §S, §T
│   ├── 20-riesgos.md           ← §X
│   └── 99-recomendacion.md     ← §Y + Master Dev Spec
└── adr/
```

`CLAUDE.md` y `AGENTS.md` apuntan a estos archivos, así cada agente carga solo lo que
necesita para la tarea del momento.

---

## 2. Preparar el repositorio

```bash
mkdir fumibug && cd fumibug && git init
mkdir -p docs/spec docs/adr .github

# copiar los archivos del bootstrap
cp .../CLAUDE.md .
cp .../AGENTS.md .
cp .../MASTER_SPEC.md docs/
cp .../adr/*.md docs/adr/
cp .../pull_request_template.md .github/
cp .../CODEOWNERS .github/
cp .../spec/*.md docs/spec/          # ya vienen partidos

git add . && git commit -m "docs: especificación, instrucciones de agentes y ADRs"
git branch develop && git push -u origin main develop
```

**Protección de ramas** (Settings → Branches), en `main` y `develop`:
- Sin push directo
- PR obligatorio con 1 aprobación
- Status checks obligatorios: `lint`, `typecheck`, `test`, `test:integration`,
  `test:tenant-isolation`, `build`, `bundle-budget`
- Ramas actualizadas antes de mergear

**Labels** (Issues → Labels):
```
agent:claude-code · agent:opencode
phase:0 · phase:1 · phase:2 · phase:3 · phase:4
module:auth · module:customers · module:services · module:routes · module:field
module:inventory · module:cash · module:certificates · module:reports
contract-change · breaking · needs-human · blocked
```

---

## 3. Fase 0 — Claude Code solo

OpenCode **no arranca todavía**. Pegá `prompts/PROMPT_FASE_0_CLAUDE_CODE.md` en Claude Code.

Son ~10 PRs secuenciales. Revisá cada uno antes de mergear. Es la fase más aburrida y la
más importante.

**Criterio de salida:** un endpoint dummy autenticado, con tenant, con permiso y auditado,
consumido desde el frontend deployado, con CI en verde.

---

## 4. Preparar el paralelismo real

Acá está la parte que suele salir mal. **Los dos agentes no pueden trabajar sobre el mismo
directorio**: se pisan los archivos sin que git se entere.

Usá `git worktree`: dos carpetas, dos ramas, un solo repo.

```bash
# repo principal → Claude Code
cd ~/dev/fumibug

# worktree paralelo → OpenCode
git worktree add ../fumibug-web develop
```

Terminal 1:
```bash
cd ~/dev/fumibug && claude
```

Terminal 2:
```bash
cd ~/dev/fumibug-web && opencode
```

Cada uno crea sus ramas desde su worktree. Comparten historial, objetos y remoto; no
comparten working copy.

**Rebase diario, sin excepción:**
```bash
git fetch origin && git rebase origin/develop
```

Con ramas de máximo 2 días y PRs que no cruzan la frontera, los conflictos reales son
raros: casi todos son en `pnpm-lock.yaml`, y esos se resuelven regenerando el lock, nunca
mergeando a mano.

---

## 5. Fase 1 en adelante — el ciclo

Para cada módulo, tres pasos (plantillas en `prompts/PROMPT_MODULO_TIPO.md`):

```
1. CONTRATO      Claude Code, PR aislado, se mergea rápido
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
2. BACKEND                        2. FRONTEND
   Claude Code                       OpenCode contra MSW
   endpoints + reglas + tests        pantallas + estados
        │                               │
        └───────────────┬───────────────┘
                        ▼
3. REVIEW CRUZADO   pasás el diff de cada uno al otro
                        │
                        ▼
   REVIEW HUMANO    reglas de negocio, dinero, estados, seguridad
                        │
                        ▼
                  squash a develop
```

**Cómo se hace el review cruzado en la práctica:**
```bash
gh pr diff 42 | pbcopy    # macOS   (Linux: | xclip -selection clipboard)
```
Y pegás eso en el otro agente con el prompt de review de `PROMPT_MODULO_TIPO.md`.
No se leen solos: vos sos el cable entre los dos.

---

## 6. Ritmo sostenible

Lo que funciona en la práctica, por sesión:

- **Un módulo por vez.** Contrato → backend + frontend → review → merge. No arranques
  tres módulos en paralelo: multiplicás los conflictos y perdés el hilo del review.
- **PRs de menos de 400 líneas.** Si un agente propone un PR gigante, pedile que lo parta.
  Un PR que no podés revisar de verdad es un PR que estás mergeando a ciegas.
- **Pará después de cada PR** y leé el diff. El costo de dejar pasar un PR malo se paga
  con intereses tres módulos después.
- **Cerrá cada fase antes de abrir la siguiente.** El criterio de salida está escrito
  justamente para que no se salte.

---

## 7. Cuándo intervenir vos

El review humano no es simbólico. Mirá con atención:

- **Todo lo que toca dinero.** Transacciones, reversas, cálculo de saldos.
- **Todo lo que toca estados.** Es donde se cuelan las transiciones inválidas.
- **Todo lo que toca inventario.** La dilución y el stock por vehículo son fáciles de
  implementar mal y difíciles de detectar hasta que el stock no cierra.
- **Cambios de contrato.** Son el punto de divergencia entre los agentes.
- **Cualquier PR con label `breaking` o `needs-human`.**

Lo que podés revisar en diagonal: pantallas de listado, componentes de UI, refactors,
documentación.

---

## 8. Señales de que algo se está desviando

| Señal | Qué significa | Qué hacer |
|---|---|---|
| Un PR toca `apps/api` y `apps/web` | Se rompió la división por capas | Rechazarlo y pedir que se parta |
| Aparece un tipo definido en `apps/web` que espeja uno de la API | Los agentes están divergiendo | Rechazar, abrir issue `contract-change` |
| Un agente propone cambiar algo del spec en el mismo PR de implementación | Se está saltando el proceso de ADR | Pedir ADR aparte |
| Los conflictos de merge dejan de ser solo del lock file | Las ramas están viviendo demasiado | Ramas más cortas, rebase diario |
| El bundle de `/campo` crece de a poco cada PR | Se está filtrando código del admin | Revisar imports dinámicos |
| Un agente empieza a "recordar mal" el spec | Está trabajando con contexto viejo | Sesión nueva, apuntando al archivo específico de `docs/spec/` |
