# ADR 0001 — Monorepo Turborepo y división del trabajo por capas

**Estado:** Aceptado · 2026-08-21

## Contexto
El proyecto lo desarrollan dos agentes de código (Claude Code y OpenCode) que no se
comunican entre sí. Toda la coordinación tiene que pasar por el repositorio. El riesgo
principal del proyecto es que ambos diverjan y produzcan sistemas incompatibles.

## Decisión
Monorepo con Turborepo + pnpm workspaces. El trabajo se divide **por capa**
(Claude Code = servidor y datos, OpenCode = navegador), no por feature. El único punto de
contacto es `packages/contracts`.

## Alternativas consideradas
- **Repos separados:** imposible compartir contratos con tipos verificados en CI.
- **División por feature** ("vos hacés clientes, yo servicios"): ambos terminarían tocando
  schema, contratos, backend y frontend de su feature, colisionando en todos los archivos
  compartidos.

## Consecuencias
- Un PR nunca cruza la frontera api/web; si toca ambos, se parte en dos.
- Los contratos se vuelven el artefacto más crítico del repo.
- Los cambios de tooling requieren coordinación humana.
