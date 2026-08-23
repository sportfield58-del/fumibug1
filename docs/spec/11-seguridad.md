<!-- Extraído de docs/MASTER_SPEC.md · secciones §K -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## K. SEGURIDAD

### K.1 Autenticación — decisión y justificación

**Supabase Auth como identity provider, NestJS como authorization server.**

Comparación honesta:

| Opción | A favor | En contra | Veredicto |
|---|---|---|---|
| JWT propio en NestJS | Control total, sin dependencia | Hay que construir: hashing, reset de password, rotación de refresh, revocación, MFA futuro, rate limiting de login. Semanas de trabajo y superficie de bugs de seguridad. | No |
| Supabase Auth + Nest verifica | Password reset, MFA, rate limiting y rotación ya resueltos y auditados. El token es un JWT estándar verificable por JWKS sin llamar a Supabase en cada request. | Dependencia de proveedor; el claim de tenant hay que agregarlo. | **Sí** |
| NextAuth/Auth.js | Cómodo en Next | La sesión vive en el frontend; con backend separado hay que puentear igual. | No |

**El problema concreto de los operarios:** no tienen email. Solución: al crear un operario, el sistema genera `{username}@{tenant-slug}.fumibug.internal` en Supabase Auth. El operario ve y tipea solo `jperez` + PIN de 6 dígitos. El PIN se trata como password (política mínima: no secuencial, no repetido, no fecha de nacimiento; bloqueo a los 5 intentos por 15 minutos; obliga a cambiarlo en el primer login).

**Claims custom:** un Auth Hook de Supabase inyecta en el token `tenant_id`, `role_key` y `permissions[]` al emitirlo. NestJS lo verifica con JWKS cacheado y arma el `RequestContext`.

**Tokens:** access 15 min, refresh 7 días en admin / 30 días en campo (rotativo, con detección de reuso). Refresh en cookie `httpOnly`+`Secure`+`SameSite=Strict` para el admin; en campo va en almacenamiento seguro del dispositivo porque la PWA debe poder revalidar sin red.

**Revocación:** `token_version` por usuario en DB, verificada en refresh. Suspender a alguien lo saca en ≤15 minutos, sin Redis.

### K.2 Autorización

Guards de NestJS componibles:

```ts
@UseGuards(JwtGuard, TenantGuard, PermissionGuard)
@RequirePermission('route.publish')
@Post(':id/publish')
```

- `JwtGuard` verifica firma y expiración.
- `TenantGuard` carga `tenant_id` del token al `AsyncLocalStorage` del request.
- `PermissionGuard` chequea el permiso y aplica el scope (`own` inyecta el filtro por `technician_id = user.id`).
- **La verificación de scope `own` es del lado del servidor, siempre.** El frontend oculta botones; eso no es seguridad.

### K.3 Multi-tenancy: por qué RLS sola no alcanza

Si NestJS se conecta con el rol `service_role` de Supabase o con un superusuario, **RLS no se aplica** — Postgres la salta. Eso convierte a la RLS en teatro. Muchos proyectos "multi-tenant con RLS" no están aislados en absoluto.

### K.4 Aislamiento real: tres capas

**Capa 1 — Extensión de Prisma (defensa principal).**
```ts
prisma.$extends({
  query: { $allModels: {
    async $allOperations({ model, operation, args, query }) {
      if (TENANT_SCOPED_MODELS.has(model)) {
        const tenantId = ctx.getStore()?.tenantId
        if (!tenantId) throw new Error(`Query a ${model} sin tenant en contexto`)
        args.where = { ...args.where, tenantId }
        if (operation.startsWith('create')) args.data = { ...args.data, tenantId }
      }
      return query(args)
    }}})
```
Olvidarse el `tenant_id` deja de ser posible: la query directamente falla.

**Capa 2 — RLS de Postgres (red de seguridad).**
La app se conecta con un rol dedicado **sin `BYPASSRLS`**. Cada request abre transacción y ejecuta `SET LOCAL app.tenant_id = '<uuid>'`. Las policies:
```sql
CREATE POLICY tenant_isolation ON services
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```
Si la Capa 1 tuviera un bug, la Capa 2 devuelve cero filas en lugar de datos ajenos.

**Capa 3 — Test automatizado.**
Un test de arquitectura que crea dos tenants con datos, se autentica como usuario del tenant A, y recorre **todos** los endpoints de lectura intentando acceder a IDs del tenant B. Debe devolver `404` en todos. Este test corre en CI y es bloqueante. Se agrega un endpoint nuevo → se agrega su caso al test, o el PR no pasa.

### K.5 Validación

Zod en el borde de entrada, sin excepción. `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`: un campo que no está en el schema hace fallar el request en lugar de colarse al ORM. Prisma parametriza todo, así que la inyección SQL no es un vector — salvo en `$queryRaw`, que solo se usa con `Prisma.sql` template tags y está prohibido concatenar strings.

### K.6 Rate limiting

| Endpoint | Límite |
|---|---|
| `/auth/login` | 5 / 15 min por IP **y** por identificador |
| `/auth/password-reset` | 3 / hora por email |
| `/public/verify/:token` | 30 / min por IP |
| `/field/sync` | 60 / min por usuario (una sincronización con backlog manda muchos eventos) |
| Global autenticado | 300 / min por usuario |
| Global anónimo | 60 / min por IP |

MVP con almacenamiento en memoria (una sola instancia). Al pasar a 2+ instancias, migrar a Redis — es el primer disparador real de Redis (§R.4).

### K.7 Upload seguro de imágenes

1. Cliente pide URL firmada a la API (`POST /field/sessions/:id/evidence/upload-url`). La API valida permiso, mime type y tamaño máximo, y devuelve una URL de Supabase Storage válida 10 minutos con path **determinado por el servidor**: `{tenant_id}/{service_id}/{uuid}.webp`. El cliente **nunca** elige el path.
2. Sube directo a Storage. No pasa por Railway (ancho de banda y timeouts).
3. Confirma con `POST .../evidence` enviando `sha256` y tamaño. La API verifica contra el objeto real.
4. Bucket **privado**. Lectura solo por URL firmada de 5 minutos generada por la API tras verificar permiso.
5. Se strippea EXIF en el cliente antes de subir; la geolocalización se guarda en columnas, no en el archivo.
6. Validación de magic bytes en la confirmación, no confianza en la extensión.
7. Un job asincrónico revisa objetos huérfanos (subidos sin confirmar) y los borra a las 24 h.

### K.8 Secretos

Nada de secretos en el repo, ni en `next.config`, ni en variables `NEXT_PUBLIC_*` (que son públicas por definición y hay que tratarlas como tales). `.env.example` con **todas** las claves y sin un solo valor real. Secretos en Railway/Vercel/GitHub Secrets. Rotación documentada. El `service_role` key de Supabase **jamás** llega al frontend — es la fuga clásica de este stack.

### K.9 Headers y transporte

Helmet con CSP estricta, HSTS con preload, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. CORS con allowlist explícita (no `*`, no reflejar el origin). HTTPS forzado. La PWA requiere HTTPS de todos modos.

### K.10 Auditoría

Interceptor de NestJS que registra toda mutación: actor, rol, acción, entidad, `before`/`after`, diff, IP, user agent, `requestId`, severidad. Se escribe **en la misma transacción** que la mutación (si no, hay operaciones sin rastro cuando falla el log). Tabla append-only con trigger que rechaza `UPDATE`/`DELETE`.

Severidad `CRITICAL` (revisión periódica obligatoria): reapertura de servicio cerrado, anulación de pago, ajuste de inventario, ajuste de caja, cambio de permisos, anulación de certificado, autoaprobación de rendición, login desde IP nueva de un usuario admin.

### K.11 Protección de datos personales

La Ley 25.326 de Protección de Datos Personales aplica: hay domicilios, teléfonos y DNI de clientes.

- Minimización: no se pide más de lo necesario. El DNI del firmante es opcional.
- **Los logs no contienen datos personales.** Se loguean IDs, no nombres ni direcciones.
- Derecho de supresión: procedimiento de anonimización (reemplaza nombre/dirección/teléfono por tokens, conserva los registros contables y sanitarios que la normativa obliga a mantener).
- Retención: fotos de evidencia 24 meses en caliente, después a storage frío; certificados sin límite (documento sanitario).
- Export de datos del cliente en JSON a pedido.

### K.12 Backups

Supabase hace PITR según plan. Encima de eso: **dump lógico diario propio** (`pg_dump`) a un bucket externo, cifrado, con retención 30 días. Un backup que nunca se restauró no es un backup: **restauración de prueba mensual documentada**, con el resultado anotado en `/docs/runbooks/restore-log.md`.

### K.13 Riesgos específicos de este dominio

| Riesgo | Mitigación |
|---|---|
| Operario "clona" el registro de un servicio sin haberlo hecho | Coordenada + timestamp del servidor + fotos con hash + duración mínima por tipo de servicio. Reporte de anomalías: servicios de duración sospechosamente corta, coordenadas repetidas exactas, fotos idénticas por hash. |
| Falsificación de GPS (apps de fake location) | No se puede prevenir en web. Se detecta por patrón: precisión perfecta constante, coordenada idéntica al centroide, saltos imposibles entre stops. Se reporta, no se bloquea. |
| Operario se lleva la base de clientes | El scope `own` limita la exposición a sus stops del día. Rate limiting por usuario. Alerta por volumen anómalo de lecturas. |
| Foto de comprobante de transferencia falsificada | El admin valida contra el extracto bancario. El sistema registra, no verifica — y eso está documentado explícitamente para no dar falsa confianza. |
| Robo del celular con sesión activa | PIN al reabrir tras 15 min de inactividad. Cierre remoto de sesión desde el admin. Sin datos financieros globales en el dispositivo. |

---
