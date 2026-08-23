# ADR 0004 — Aislamiento multi-tenant en tres capas

**Estado:** Aceptado · 2026-08-21

## Contexto
"Multi-tenant con RLS de Supabase" es una frase que suele describir sistemas que no están
aislados en absoluto: si el backend se conecta con `service_role` o con un superusuario,
**Postgres saltea las policies**. La RLS queda como teatro de seguridad.

## Decisión
Tres capas independientes:

1. **Extensión de Prisma** que inyecta `tenantId` en toda query de modelos multi-tenant y
   lanza excepción si no hay tenant en el `AsyncLocalStorage`. Olvidarse el filtro deja de
   ser posible.
2. **RLS de Postgres** con un rol de aplicación **sin `BYPASSRLS`**, y `SET LOCAL
   app.tenant_id` por transacción. Si la capa 1 tuviera un bug, esta devuelve cero filas.
3. **Test automatizado bloqueante** que recorre todos los endpoints con un usuario del
   tenant A e IDs del tenant B, exigiendo `404` en el 100% de los casos.

## Alternativas consideradas
- **Schema o base por tenant:** más aislamiento, pero migraciones × N y backups × N.
  No se justifica hasta enterprise.
- **Solo filtrado en la capa de aplicación:** un `findMany` sin `where` filtra todo.

## Consecuencias
- El rol de conexión de la app tiene que crearse explícitamente, sin `BYPASSRLS`.
- Cada endpoint nuevo obliga a agregar su caso al test de aislamiento, o el PR no pasa.
- Los recursos de otro tenant devuelven `404`, no `403`, para no filtrar existencia.
