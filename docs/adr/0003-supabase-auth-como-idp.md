# ADR 0003 — Supabase Auth como IdP, NestJS como authorization server

**Estado:** Aceptado · 2026-08-21

## Contexto
Hace falta autenticación para admins (con email) y para operarios de campo, que en general
**no tienen email**.

## Decisión
Supabase Auth como identity provider. NestJS verifica el JWT por JWKS cacheado y resuelve
toda la autorización. Un Auth Hook inyecta `tenant_id`, `role_key` y `permissions[]` como
claims al emitir el token.

Para operarios: el sistema genera `{username}@{tenant-slug}.fumibug.internal` en Supabase
Auth. El operario tipea solo `jperez` + PIN de 6 dígitos.

## Alternativas consideradas
- **JWT propio:** habría que construir hashing, reset de password, rotación de refresh,
  revocación, MFA futuro y rate limiting de login. Semanas de trabajo y mucha superficie
  de bugs de seguridad.
- **NextAuth:** la sesión vive en el frontend; con backend separado habría que puentear igual.

## Consecuencias
- Dependencia de Supabase para identidad (aceptable: es JWT estándar, migrable).
- El PIN se trata como password, con política mínima y bloqueo por intentos.
- Revocación por `token_version` en DB, verificada en refresh: sale en ≤15 minutos sin Redis.
