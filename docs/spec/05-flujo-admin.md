<!-- Extraído de docs/MASTER_SPEC.md · secciones §E -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## E. FLUJO DEL ADMINISTRADOR

### E.1 Camino feliz

1. **Login.** Email + password. Sesión larga en desktop (7 días con refresh rotativo).
2. **Dashboard.** Lo primero que ve: alertas accionables. "3 rendiciones sin aprobar", "2 servicios rechazados", "stock de Cipermetrina bajo mínimo", "libreta de Juan vence en 12 días".
3. **Entrada del trabajo.** Tres orígenes:
   - Manual: el teléfono suena. Alta de cliente + ubicación + servicio en una sola pantalla, sin salir.
   - Automático: el generador de contratos creó los servicios del mes.
   - Revisita de garantía: desde un servicio `COMPLETED`, botón "generar revisita", precio 0, `is_warranty_visit = true`.
4. **Planificación.** Vista semana. Los servicios `SCHEDULED` aparecen en el panel izquierdo agrupados por zona. Se filtran por fecha objetivo.
5. **Asignación.** Drag del servicio a la columna del operario y día. Se crea `route` en `DRAFT` si no existía, y un `route_stop`. Advertencias en vivo, no bloqueos (excepto libreta vencida).
6. **Armado y orden.** Reordenar stops. Definir hora estimada de cada uno. Botón "optimizar orden" en Fase 2; en MVP, orden manual con ayuda visual de mapa.
7. **Validación pre-publicación.** El botón "Publicar" corre los guards de §W.2 y muestra el resultado antes de confirmar. Si falta stock del químico requerido para los servicios de la ruta, advierte con el faltante calculado.
8. **Publicación.** Modal de confirmación con resumen: "Ruta de Juan, viernes 22/08, 7 servicios, 09:00–17:30". Confirmar → transacción atómica → push al operario.
9. **Monitoreo.** Vista "Hoy" con una fila por operario y un chip por stop, coloreado por estado. Actualización por polling cada 60s en MVP (no WebSockets, §R.4). Se ve el atraso acumulado.
10. **Cierres.** Cola de `PENDING_VALIDATION`. El admin abre, ve fotos, firma, insumos, pago, y aprueba o rechaza con motivo.
11. **Certificados.** Cola de servicios `COMPLETED` sin certificado. Emisión individual o en lote. El DT firma en lote.
12. **Rendición.** El operario declaró $148.000. El admin cuenta, confirma o registra diferencia.
13. **Reportes.** Cierre de semana/mes.

### E.2 Casos excepcionales (todos deben estar implementados)

| Situación | Comportamiento requerido |
|---|---|
| Cliente cancela una hora antes, ruta publicada e iniciada | Admin cancela el servicio → `route_stop` a `CANCELLED` → **push inmediato al operario** + banner rojo en su app. Si el operario ya está `EN_ROUTE`, se registra `wasted_trip = true` para reporte de costos. |
| Cliente pide cambio de horario el mismo día | Admin reordena los stops de una ruta publicada. Permitido con `route.update` + audit. El operario recibe push "tu ruta cambió" y la app refresca. **Nunca se reordena silenciosamente.** |
| Se enferma un operario a la mañana | Función "reasignar ruta completa": mueve todos los stops `PENDING` a otro operario. Los ya ejecutados quedan con el operario original. Genera dos rutas históricas coherentes. |
| Entra una urgencia con la ruta publicada | "Insertar stop": agrega a ruta publicada, requiere `route.update`, notifica. Se inserta en la posición elegida y recalcula las horas estimadas hacia abajo. |
| El operario cierra mal (fotos borrosas, insumo sin cargar) | Rechazo con motivo → vuelve a `IN_EXECUTION` → el operario ve la tarea en rojo en su app con el comentario. |
| Servicio completado hace 3 días con dato mal cargado | Reapertura por Admin, ventana de 7 días, motivo obligatorio, **anula certificado emitido**, audit crítico. Después de 7 días: no se reabre, se emite nota de corrección. |
| Un pago se cargó dos veces | No se edita: se anula por reversa (`payment.void`), que genera un `cash_movement` contrario. Ambos quedan visibles. |
| Falta stock para publicar | Advertencia con faltante exacto y botón directo a "transferir del depósito". |
| Dos admins editan la misma ruta a la vez | Bloqueo optimista por `version`. El segundo recibe `409` con "Esta ruta fue modificada por Ana hace 30 segundos. Recargar." |

---

