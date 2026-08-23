<!-- Extraído de docs/MASTER_SPEC.md · secciones §D -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## D. ESTADOS DEL SISTEMA

### D.1 Por qué tu máquina de estados no funciona

Tu lista era:

```
DRAFT → SCHEDULED → ASSIGNED → PUBLISHED → EN_ROUTE → ARRIVED
→ IN_PROGRESS → PENDING_CLOSURE → COMPLETED / CANCELLED / NO_SHOW
```

Cuatro problemas concretos:

1. **`PUBLISHED` no es un estado del servicio.** Publicar es una acción sobre la *ruta*. Si una ruta tiene 8 servicios y despublicás, tenés que revertir 8 estados a mano y no sabés a cuál volver.
2. **`EN_ROUTE` / `ARRIVED` no son del servicio, son del intento de visita.** Si el operario va, el cliente no está, y se reprograma para el jueves: ¿el servicio vuelve de `ARRIVED` a `SCHEDULED`? Perdés el registro de que hubo un viaje fallido, que tiene costo real y que a veces se cobra.
3. **`NO_SHOW` como estado terminal del servicio es incorrecto.** Cliente ausente no cierra el servicio, lo *reprograma*. `NO_SHOW` es el **resultado de una visita**, no el final de un trabajo.
4. **Falta la validación administrativa.** `PENDING_CLOSURE` está pero no está claro quién la saca. Y falta un estado para "el operario dice que terminó pero el admin todavía no lo revisó", que es donde se detectan las fotos faltantes.

### D.2 Modelo corregido: tres ciclos de vida

```
SERVICE ──────► el trabajo comercial. Vive hasta que se completa o se cancela.
   │              Puede requerir varias visitas.
   ├─► ROUTE_STOP ──► un intento de visita planificado, en una ruta, un día.
   │                   Puede terminar en éxito o en fracaso (ausente, inaccesible).
   └─► SERVICE_SESSION ──► el registro cronometrado de una ejecución efectiva.
                            Solo existe si el operario efectivamente empezó a trabajar.
```

Relación: `service 1..N route_stop`, `route_stop 0..1 service_session`.

### D.3 Máquina de estados: SERVICE

| Estado | Significado |
|---|---|
| `DRAFT` | Cargado incompleto. No entra al planificador. |
| `SCHEDULED` | Tiene fecha objetivo, sin operario. Aparece en el panel "sin asignar". |
| `ASSIGNED` | Está dentro de un `route_stop` de una ruta en `DRAFT`/`READY`. |
| `DISPATCHED` | Su ruta fue publicada. El operario ya lo ve. *(Reemplaza tu `PUBLISHED`.)* |
| `IN_EXECUTION` | Hay una sesión abierta. |
| `PENDING_VALIDATION` | El operario cerró. Falta revisión administrativa. *(Reemplaza `PENDING_CLOSURE`.)* |
| `COMPLETED` | Validado. Habilita certificado. **Inmutable.** |
| `PARTIALLY_COMPLETED` | Se hizo parte, requiere revisita. Genera servicio hijo automáticamente. |
| `RESCHEDULED` | Estado transitorio: hubo un intento fallido, vuelve a `SCHEDULED` con nueva fecha. |
| `CANCELLED` | Terminal. Con motivo obligatorio y flag `billable` (cancelación tardía a veces se cobra). |

Transiciones:

```
DRAFT ──────────► SCHEDULED ──────► ASSIGNED ──────► DISPATCHED ──────► IN_EXECUTION
  │                   ▲   ▲             │  ▲              │  │                 │
  │                   │   └─────────────┘  └──────────────┘  │                 │
  │                   │      (desasignar)   (despublicar)    │                 │
  │                   │                                       │                 ▼
  │                   └───────────────────────────────────────┘        PENDING_VALIDATION
  │                            (RESCHEDULED: ausente / inaccesible)      │      │
  │                                                                      │      │
  └──────────► CANCELLED ◄─────────(desde cualquier estado no terminal)  │      │
                                                                          ▼      ▼
                                                    PARTIALLY_COMPLETED  COMPLETED
                                                              │              ▲
                                                              └──► (genera servicio hijo)
                                                                             │
                                                            (rechazo: vuelve a IN_EXECUTION)
```

**Quién puede ejecutar cada transición:**

| Transición | Quién | Condiciones |
|---|---|---|
| `DRAFT → SCHEDULED` | `service.update` | Tiene cliente, ubicación, tipo, fecha objetivo y precio. |
| `SCHEDULED → ASSIGNED` | `route.update` | Se creó un `route_stop`. Operario con libreta vigente. |
| `ASSIGNED → SCHEDULED` | `route.update` | Ruta no publicada. |
| `ASSIGNED → DISPATCHED` | `route.publish` | Automático al publicar la ruta. Nunca manual. |
| `DISPATCHED → ASSIGNED` | `route.unpublish` | Solo si ningún stop de la ruta tiene sesión abierta o cerrada. |
| `DISPATCHED → IN_EXECUTION` | `session.start` (Operario asignado) | Ruta en `IN_PROGRESS`, no hay otra sesión abierta del mismo operario. |
| `IN_EXECUTION → PENDING_VALIDATION` | `session.finish` (Operario) | Checklist de cierre completo (§I.R4). |
| `PENDING_VALIDATION → COMPLETED` | `service.validate` | Evidencia mínima OK. |
| `PENDING_VALIDATION → IN_EXECUTION` | `service.reject` | Motivo obligatorio. Notifica al operario. Reabre la sesión. |
| `* → RESCHEDULED → SCHEDULED` | `service.reschedule` | Automático si el stop cerró en `NO_SHOW`/`INACCESSIBLE`; el admin fija nueva fecha. |
| `* → CANCELLED` | `service.cancel` | Motivo obligatorio de una lista cerrada. Si estaba en ruta publicada, notifica al operario. |
| `COMPLETED → IN_EXECUTION` | `session.reopen` (solo Admin/Owner) | Ventana de 7 días. Motivo obligatorio. **Anula el certificado si ya fue emitido.** Audit crítico. |

### D.4 Máquina de estados: ROUTE

| Estado | Significado |
|---|---|
| `DRAFT` | En armado. El operario no la ve. Editable libremente. |
| `READY` | Validada, lista para publicar. Editable. *(Estado opcional pero útil: permite armar el jueves la ruta del viernes y que un Supervisor la revise.)* |
| `PUBLISHED` | Visible para el operario. **Edición restringida** (§I.R13). |
| `IN_PROGRESS` | El operario inició la jornada o el primer stop. |
| `COMPLETED` | Todos los stops en estado terminal + operario cerró jornada. |
| `CANCELLED` | Terminal. Todos los stops vuelven a `SCHEDULED`. |

```
DRAFT ⇄ READY ──► PUBLISHED ──► IN_PROGRESS ──► COMPLETED
  │        │          │              │
  └────────┴──────────┴──────────────┴──────► CANCELLED
                      └──► DRAFT (unpublish, solo si ningún stop arrancó)
```

**`READY` merece existir** porque separa "estoy armando" de "está lista pero todavía no la quiero mostrar". Sin ese estado, o el operario ve rutas a medio armar, o el admin publica a las 7 de la mañana corriendo.

### D.5 Máquina de estados: ROUTE_STOP

Este es el que faltaba por completo en tu planteo.

| Estado | Significado |
|---|---|
| `PENDING` | Planificado, sin acción. |
| `EN_ROUTE` | El operario apretó "voy en camino". Registra hora y coordenada de salida. |
| `ARRIVED` | Llegó. Registra hora, coordenada y `accuracy`. |
| `IN_PROGRESS` | Sesión abierta. |
| `DONE` | Ejecutado y cerrado por el operario. |
| `NO_SHOW` | Cliente ausente. **Requiere evidencia**: foto de la fachada + hora + coordenada. |
| `INACCESSIBLE` | Llegó pero no pudo trabajar (obra, local cerrado, mascota suelta, sin agua). Motivo de lista cerrada + foto. |
| `SKIPPED` | Salteado por decisión operativa (se hizo tarde, se fue la luz). Motivo obligatorio. |
| `CANCELLED` | El servicio se canceló mientras la ruta estaba activa. |

```
PENDING ──► EN_ROUTE ──► ARRIVED ──► IN_PROGRESS ──► DONE
   │            │            │                          
   │            │            ├──► NO_SHOW ──────┐       
   │            │            └──► INACCESSIBLE ─┤       
   ├────────────┴──► SKIPPED ────────────────────┤      
   └──► CANCELLED                                 │      
                                                  ▼      
                                    dispara service → RESCHEDULED
```

**`EN_ROUTE` es opcional.** El operario puede ir directo de `PENDING` a `ARRIVED` (se olvidó de apretar el botón). El sistema no debe obligarlo: cada botón obligatorio en campo es un servicio que no se registra. Se registra el salto y listo.

### D.6 Estados de SERVICE_SESSION

`OPEN` → `CLOSED` → (`REOPENED` → `CLOSED`). Con `started_at`, `ended_at`, `paused_intervals[]` (el operario para a almorzar en medio de un trabajo de 4 horas — sin pausas, el tiempo efectivo es basura).

### D.7 Estados de dinero

- `payment`: `CONFIRMED` | `VOIDED` (nunca `PENDING` en el MVP: se registra lo que ya se cobró).
- `cash_closure`: `OPEN` → `DECLARED` (el operario contó) → `RECONCILED` (el admin recibió y aceptó) | `DISPUTED` (hay diferencia sin resolver).
- `certificate`: `DRAFT` → `ISSUED` → `SIGNED` → `VOIDED`.

### D.8 Regla transversal de implementación

**Toda transición de estado se hace en el backend, dentro de una transacción, con validación previa contra una tabla de transiciones permitidas.** Nunca `service.status = 'COMPLETED'` desde un controller. Un único `StateMachineService` genérico:

```ts
await stateMachine.transition({
  entity: 'service', id, from: expectedCurrentStatus, to: 'COMPLETED',
  actor: user, reason?, guards: [...]
})
```

Si `from` no coincide con el estado actual en la DB (`SELECT ... FOR UPDATE`), falla con `409 CONFLICT`. Esto resuelve el 90% de los problemas de concurrencia (§I.R20).

---
