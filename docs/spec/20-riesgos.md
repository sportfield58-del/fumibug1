<!-- Extraído de docs/MASTER_SPEC.md · secciones §X -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## X. RIESGOS

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|:--:|:--:|---|
| 1 | **El operario no usa la app** y vuelve al cuaderno | Alta | Crítico | Un operario en el diseño desde la semana 1. Prototipo en su celular real en Fase 1. Menos de 2 minutos de registro por servicio, medido. Offline real. Si la app no le ahorra tiempo, no la va a usar por más orden que le dé el dueño. |
| 2 | **La sincronización offline duplica datos** (pagos, consumo) | Media | Crítico | Idempotencia por `client_event_id` con constraint única en DB desde el primer commit. Suite de tests que simula pérdida de red, reintentos y duplicados. Es la clase de bug que destruye la confianza en el sistema. |
| 3 | **Fuga de datos entre tenants** | Baja | Crítico | Tres capas (§K.4) + test bloqueante en CI. |
| 4 | **La caja no cierra** y el sistema pierde credibilidad financiera | Media | Alto | Libro append-only, esperado calculado, transacciones atómicas, saldo cero obligatorio, centavos enteros. |
| 5 | **Los certificados salen mal** (dato equivocado, numeración con huecos) | Media | Crítico | Snapshot al emitir, numeración con bloqueo, validación de completitud, inmutabilidad tras firma. Un certificado mal emitido es un problema legal, no un bug. |
| 6 | **Los dos agentes divergen** y producen código incompatible | Alta | Alto | Contratos como fuente única, división por capas, PRs que no cruzan la frontera, mocks generados, review cruzado, CI bloqueante. Es el riesgo más probable de todos. |
| 7 | **Sobreingeniería**: se construye el SaaS antes de que funcione el producto | Alta | Alto | Roadmap con criterios de salida. Nada de billing hasta el segundo cliente pagando. Esta especificación es larga justamente para que el alcance no se estire por improvisación. |
| 8 | **Costos de Google Maps se disparan** | Media | Medio | Geocoding persistido, sin Distance Matrix en MVP, navegación por links, límite de gasto en la consola desde el día 1. |
| 9 | El GPS resulta inútil en la práctica (imprecisión, permisos denegados) | Media | Medio | Ya está tratado como evidencia y no como control. Nada del flujo depende de él. |
| 10 | **Fotos que consumen storage y ancho de banda sin control** | Alta | Medio | Compresión a WebP <300 KB, límite por servicio, lifecycle a storage frío a 24 meses, monitoreo de costo mensual. |
| 11 | Supabase cambia precios o límites | Baja | Alto | Postgres estándar y Storage compatible con S3: la migración a Neon + R2 es factible. **Ningún uso de funciones propietarias de Supabase fuera de Auth y Storage.** |
| 12 | Un solo desarrollador/orquestador humano se convierte en cuello de botella | Alta | Medio | Criterios de aceptación explícitos, CI que valida sin intervención, review cruzado entre agentes que filtra antes del humano. |
| 13 | El alcance crece durante el desarrollo ("ya que estamos...") | Alta | Alto | Todo cambio de alcance es un issue con label `needs-human` y actualización del MASTER_SPEC. Nada entra por conversación. |
| 14 | Datos legacy de Fumibug mal migrados | Media | Medio | Import CSV con validación, dry-run, reporte de errores por fila, y período de convivencia con el sistema viejo. |
| 15 | Pérdida de datos por fallo de infraestructura | Baja | Crítico | PITR + dump diario a bucket externo + **restauración de prueba mensual documentada**. |
| 16 | Conflicto laboral por el registro de ubicación de operarios | Media | Medio | Conversarlo con la empresa **antes** de construir tracking. En MVP solo hay puntos discretos en momentos de trabajo, no seguimiento continuo — y eso es defendible. Documentar la política y comunicarla a los operarios. |
| 17 | El Director Técnico no está disponible para firmar y se traban los certificados | Media | Medio | Firma en lote, notificación diaria de pendientes, posibilidad de más de un DT por tenant. |
| 18 | Celulares viejos que no soportan la PWA | Media | Medio | Objetivo: Android 8+ y Chrome 90+. Probar en un dispositivo de gama baja real, no solo en el emulador. Presupuesto de bundle en CI. |

---
