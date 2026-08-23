<!-- Extraído de docs/MASTER_SPEC.md · secciones §B -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## B. ACTORES, ROLES Y PERMISOS

### B.1 Modelo de permisos elegido

**RBAC con permisos granulares y scope**, no roles hardcodeados en el código.

```
user → membership(tenant) → role → permissions[]
```

- Un `user` puede pertenecer a varios `tenants` (necesario para SaaS y para el soporte de Fumibug).
- El `role` vive **dentro** del tenant. Un tenant puede crear roles propios (Fase 3).
- El código **nunca** pregunta `if (user.role === 'ADMIN')`. Pregunta `if (can(user, 'route.publish'))`.
- Los permisos se resuelven al emitir el token y se cachean en el request; se revalidan contra DB en toda operación de escritura sensible (dinero, inventario, publicación).

**Por qué no ABAC/CASL completo en el MVP:** la complejidad de políticas dinámicas no se paga todavía. Pero el diseño deja lugar: cada permiso admite un `scope` opcional (`own` | `team` | `tenant`), que es lo único de ABAC que realmente se necesita (ej: "el operario ve solo *sus* servicios").

### B.2 Catálogo de permisos

Formato `recurso.acción`. Lista completa del MVP:

```
# Clientes y ubicaciones
customer.read | customer.create | customer.update | customer.archive
location.read | location.create | location.update | location.archive

# Contratos y servicios
contract.read | contract.create | contract.update | contract.cancel
service.read.own | service.read.tenant | service.create | service.update
service.cancel | service.reschedule | service.price.override

# Rutas
route.read.own | route.read.tenant | route.create | route.update
route.publish | route.unpublish | route.cancel

# Ejecución
session.start | session.finish | session.reopen
evidence.upload | evidence.delete
stop.mark_no_show | stop.skip

# Cierre y validación
service.close | service.validate | service.reject

# Certificados
certificate.read | certificate.issue | certificate.sign | certificate.void

# Insumos e inventario
supply.read | supply.create | supply.update
inventory.read.own | inventory.read.tenant
inventory.transfer | inventory.adjust | inventory.allow_negative

# Dinero
payment.read.own | payment.read.tenant | payment.create | payment.void
cash.read.own | cash.read.tenant | cash.close.own
cash.approve_closure | cash.adjust

# Administración
user.read | user.create | user.update | user.deactivate
role.manage | settings.manage | audit.read
report.operational | report.financial
```

### B.3 Matriz rol × permiso (roles semilla)

| Permiso (grupo) | Owner | Admin | Supervisor | Administrativo | Operario | Director Técnico |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Clientes / ubicaciones (CRUD) | ✔ | ✔ | R | ✔ | R (solo de sus stops) | R |
| Contratos | ✔ | ✔ | R | crear/editar | — | — |
| Servicios: ver | tenant | tenant | tenant | tenant | **own** | tenant |
| Servicios: crear / editar | ✔ | ✔ | ✔ | ✔ | — | — |
| Servicios: cancelar / reprogramar | ✔ | ✔ | ✔ | ✔ | — | — |
| **Override de precio** | ✔ | ✔ | — | — | — | — |
| Rutas: armar / editar borrador | ✔ | ✔ | ✔ | ✔ | — | — |
| **Rutas: publicar** | ✔ | ✔ | ✔ | — | — | — |
| **Rutas: despublicar** (con ruta iniciada) | ✔ | ✔ | — | — | — | — |
| Iniciar / finalizar sesión | — | — | — | — | ✔ (own) | — |
| Subir evidencia | — | — | — | — | ✔ (own) | — |
| Marcar cliente ausente | — | — | — | — | ✔ (own) | — |
| **Reabrir servicio cerrado** | ✔ | ✔ | — | — | — | — |
| Validar / rechazar cierre | ✔ | ✔ | ✔ | — | — | — |
| Emitir certificado | ✔ | ✔ | ✔ | ✔ | — | ✔ |
| **Firmar certificado** | — | — | — | — | — | ✔ |
| **Anular certificado** | ✔ | ✔ | — | — | — | ✔ |
| Insumos: catálogo | ✔ | ✔ | R | R | R | R |
| Inventario: ver | tenant | tenant | tenant | tenant | **own** | — |
| Inventario: transferir a operario | ✔ | ✔ | ✔ | — | — | — |
| **Inventario: ajustar** | ✔ | ✔ | — | — | — | — |
| **Inventario: permitir negativo** | ✔ | — | — | — | — | — |
| Registrar pago | ✔ | ✔ | ✔ | ✔ | ✔ (own) | — |
| **Anular pago** | ✔ | ✔ | — | — | — | — |
| Caja: ver | tenant | tenant | tenant | tenant | **own** | — |
| Cerrar su caja (rendir) | — | — | — | — | ✔ | — |
| **Aprobar rendición / ajustar diferencia** | ✔ | ✔ | ✔ (hasta límite) | — | — | — |
| Usuarios y roles | ✔ | ✔ | — | — | — | — |
| **Eliminar tenant / transferir propiedad** | ✔ | — | — | — | — | — |
| Configuración | ✔ | ✔ | — | — | — | — |
| Audit log | ✔ | ✔ | R (90 días) | — | — | — |
| Reportes operativos | ✔ | ✔ | ✔ | ✔ | — | — |
| **Reportes financieros** | ✔ | ✔ | — | R (sin rentabilidad) | — | — |

R = read only. `own` = limitado a registros donde el usuario es el asignado.

### B.4 Reglas de permisos no negociables

1. **Nadie borra nada.** No existe `DELETE` de negocio. Todo es `archived_at` / `voided_at` / asiento de reversa. El único borrado físico es por pedido de eliminación de datos personales (§K.11).
2. **El Operario nunca ve dinero ajeno.** Ni caja de otro operario, ni precio de servicios que no ejecutó, ni márgenes.
3. **El Operario no puede editar un servicio cerrado.** Ni siquiera el suyo. Pide reapertura, un Admin la concede, queda auditado.
4. **Quien ejecuta no aprueba.** El operario rinde, el Admin/Supervisor aprueba. Nunca la misma persona en la misma transacción financiera.
5. **El Director Técnico es el único que firma.** Ni el Owner puede firmar un certificado si no tiene matrícula cargada y vigente.
6. **Escalada de permisos imposible.** Un rol no puede asignar un permiso que él mismo no tiene.

### B.5 Caso borde importante: el Owner que también es Operario

Frecuentísimo en pymes: el dueño sale a fumigar. El modelo lo soporta porque los permisos son aditivos y el scope `own` no molesta al scope `tenant`. Pero se rompe la regla #4. **Decisión:** si un usuario tiene ambos permisos (`cash.close.own` y `cash.approve_closure`), la autoaprobación se permite pero se marca `self_approved = true` y se resalta en rojo en el reporte de auditoría. No se bloquea: bloquearlo haría inusable el sistema en una empresa de 3 personas.

---
