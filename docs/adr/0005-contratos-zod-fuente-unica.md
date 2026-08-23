# ADR 0005 — Contratos Zod como fuente única de verdad

**Estado:** Aceptado · 2026-08-21

## Contexto
Dos agentes que no se hablan necesitan un artefacto compartido, versionado y verificable
por CI, que defina el límite entre backend y frontend.

## Decisión
`packages/contracts` con schemas Zod. De ahí se derivan: validación en NestJS, tipos de
TypeScript de ambos lados, cliente API del frontend, handlers de MSW y `openapi.json`.

Reglas: OpenCode nunca define un tipo de API. Claude Code nunca mezcla cambio de contrato
con implementación — va en un PR aislado.

## Alternativas consideradas
- **OpenAPI first con generación de código:** más ceremonia, peor DX, y la validación en
  runtime queda desacoplada del tipo.
- **tRPC:** excelente DX, pero acopla frontend y backend en un grado que rompe la división
  por capas, y complica que el día de mañana haya clientes que no sean este frontend.

## Consecuencias
- Los mocks generados permiten que OpenCode desarrolle sin esperar al backend. Ese es todo
  el mecanismo del paralelismo.
- Un cambio de contrato es un evento visible del proyecto, no un detalle de implementación.
