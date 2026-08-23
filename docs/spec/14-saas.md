<!-- Extraído de docs/MASTER_SPEC.md · secciones §Q -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## Q. MULTI-TENANCY / SAAS

### Q.1 Estrategia de aislamiento

| Estrategia | Aislamiento | Costo operativo | Veredicto |
|---|---|---|---|
| Base por tenant | Máximo | Migraciones × N bases, backups × N, conexiones × N | No hasta enterprise |
| Schema por tenant | Alto | Migraciones × N schemas, límites de Postgres ~ cientos | No |
| **Fila con `tenant_id` + RLS + capa de app** | Suficiente si se hace bien | Una migración, un backup, un pool | **Sí** |

Con las tres capas de §K.4 el riesgo real es aceptable. Y si mañana un cliente enterprise exige base dedicada, el mismo código funciona apuntando a otra conexión: el `tenant_id` sigue estando.

### Q.2 Modelo comercial

```
tenant ─┬─ subscription ─── plan ─── plan_features
        ├─ memberships ─── users
        ├─ usage_counters (servicios/mes, usuarios activos, GB de storage)
        └─ [todos los datos de negocio]
```

Tablas de Fase 3 (**no** se construyen en el MVP, pero `tenants.plan` existe desde el día 1 para no migrar después):
`plans`, `plan_features`, `subscriptions`, `usage_counters`, `invoices`.

Planes propuestos (hipótesis a validar con clientes reales, no con una planilla):

| | Core | Pro | Enterprise |
|---|---|---|---|
| Operarios | hasta 5 | hasta 20 | ilimitado |
| Servicios/mes | 300 | 2.000 | ilimitado |
| Certificados | ✔ | ✔ | ✔ |
| Contratos recurrentes | ✔ | ✔ | ✔ |
| Estaciones de monitoreo | — | ✔ | ✔ |
| Portal del cliente | — | ✔ | ✔ |
| WhatsApp automatizado | — | ✔ | ✔ |
| API / integraciones | — | — | ✔ |
| Marca propia en certificados | logo | logo + colores | dominio propio |
| Storage | 5 GB | 50 GB | a medida |

### Q.3 Cómo se garantiza que una empresa no vea otra

Ya está en §K.4, pero resumido para que quede como checklist verificable:

1. `tenant_id` en toda tabla de negocio — **verificado por test de schema** que lista las tablas y falla si alguna no lo tiene.
2. Extensión de Prisma que inyecta el filtro — imposible olvidarlo.
3. RLS de Postgres con rol sin `BYPASSRLS` — red de seguridad.
4. `tenant_id` viene del JWT, jamás del request.
5. Recursos ajenos devuelven `404`, no `403`.
6. Los paths de Storage empiezan por `tenant_id` y las policies del bucket lo verifican.
7. Test de aislamiento cross-tenant bloqueante en CI, ampliado con cada endpoint nuevo.
8. Auditoría con `tenant_id` — cualquier acceso cruzado queda registrado.

### Q.4 Onboarding SaaS (Fase 3)

Registro → verificación de email → crear empresa (nombre, CUIT, habilitación sanitaria) → wizard de 3 pasos (cargar Director Técnico, cargar 3 insumos frecuentes, cargar el primer cliente) → **momento de valor**: crear y publicar el primer servicio en menos de 10 minutos → invitar operarios por link con PIN temporal.

Trial de 14 días sin tarjeta. Import de clientes por CSV desde el primer día — nadie migra 400 clientes a mano, y es el mayor obstáculo de conversión.

### Q.5 Lo que hay que resistir

No construir billing, planes, feature flags ni onboarding autoservicio hasta tener **la segunda empresa pagando**. Es la trampa clásica: seis meses construyendo infraestructura SaaS para un producto que todavía no demostró que resuelve el problema de la primera empresa.

---

