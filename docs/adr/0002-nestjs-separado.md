# ADR 0002 — NestJS separado en lugar de API routes de Next.js

**Estado:** Aceptado · 2026-08-21

## Contexto
Con Next.js App Router se podría hacer todo en un solo deploy usando route handlers.

## Decisión
Backend NestJS independiente, deployado en Railway.

## Razones
1. Los guards e interceptores de Nest mapean uno a uno con RBAC + tenant context +
   auditoría. En Next habría que rearmar esa cadena a mano en cada handler, y basta
   olvidarse una vez para tener un agujero.
2. Los jobs (generador de contratos recurrentes, cierre de sesiones colgadas,
   reconciliación de inventario) necesitan un proceso persistente. Las serverless
   functions de Vercel no sirven para eso.
3. La separación es exactamente la línea de corte entre los dos agentes.

## Alternativas consideradas
- **Todo en Next:** un deploy menos, pero pierde las tres razones de arriba.
- **Fastify plano:** menos estructura, más código de plataforma escrito a mano.

## Consecuencias
- Dos deploys, CORS a configurar, latencia extra de un salto.
- El frontend nunca habla directo con la base de datos ni con la API de datos de Supabase.
