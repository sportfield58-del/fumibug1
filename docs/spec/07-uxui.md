<!-- Extraído de docs/MASTER_SPEC.md · secciones §G -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## G. UX / UI

### G.1 Sistema de diseño

Dirección estética: **utilitario premium**. Referencia mental: Linear para el admin, Google Maps para el operario. Nada decorativo. El producto se usa 8 horas por día por gente apurada.

**Tokens** (fuente única: `packages/ui/tokens.css`, consumidos por Tailwind):

```css
/* Neutros — nunca negro puro ni blanco puro */
--bg:            #FAFAF9;   --bg-elevated:  #FFFFFF;
--border:        #E7E5E4;   --border-strong:#D6D3D1;
--fg:            #1C1917;   --fg-muted:     #57534E;  --fg-subtle: #A8A29E;

/* Primario — verde técnico, no "verde ecológico" */
--primary:       #15803D;   --primary-hover:#166534;  --primary-fg: #FFFFFF;
--primary-subtle:#F0FDF4;

/* Semánticos de estado (usados en chips de servicio/stop) */
--state-draft:   #A8A29E;   --state-scheduled: #0369A1;  --state-dispatched: #7C3AED;
--state-progress:#EA580C;   --state-done:      #15803D;  --state-problem:    #DC2626;
--state-pending: #CA8A04;

/* Radios / sombras / transiciones */
--radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 14px;  --radius-full: 9999px;
--shadow-sm: 0 1px 3px rgba(28,25,23,.08), 0 1px 2px rgba(28,25,23,.04);
--shadow-md: 0 4px 16px rgba(28,25,23,.08), 0 2px 4px rgba(28,25,23,.04);
--transition: 150ms cubic-bezier(.4,0,.2,1);
```

**Tipografía:** Inter (`next/font`, self-hosted, sin llamada externa — el operario puede estar en 3G). Escala: `display 30/36` · `h1 24/32` · `h2 20/28` · `h3 16/24` · `body 15/22` · `caption 13/18` · `mono 13` (para montos y códigos, tabular-nums obligatorio).

**Espaciado:** escala de 4px (4, 8, 12, 16, 24, 32, 48, 64).

**Breakpoints:** 375 / 640 / 1024 / 1440. Admin optimizado a 1440. Campo optimizado a 375–412.

**Reglas específicas de la app de campo, no negociables:**
- Touch target mínimo **56×56 px** (no 44 — el operario usa guantes).
- Botón de acción principal: ancho completo, 64 px de alto, fijo abajo, siempre visible.
- Contraste mínimo **7:1** en texto principal (AAA), porque se usa bajo sol directo.
- Cero hover como único indicador de estado.
- Modo alto contraste opcional en configuración.
- **Sin animaciones de más de 200 ms** y respeto a `prefers-reduced-motion`.

### G.2 Pantallas — ADMIN DESKTOP

Formato: Objetivo · Componentes · Datos · Acciones · Empty · Loading · Error · Confirmación · Permiso.

---

**AD-01 · Login**
Objetivo: entrar rápido. · Card centrada, logo, email, password, "recordarme", link recupero. · — · Entrar. · — · Botón con spinner, campos deshabilitados. · Mensaje genérico "Email o contraseña incorrectos" (nunca revelar cuál). Tras 5 intentos, captcha. · — · Público.

**AD-02 · Dashboard**
Objetivo: saber qué requiere atención hoy. · Fila de 4 KPI cards + panel de alertas accionables + tabla "servicios de hoy" + mini-timeline de operarios. · Servicios hoy por estado, cobrado hoy (efectivo/transferencia separados), pendiente de rendición, alertas. · Click en KPI → lista filtrada. Click en alerta → acción directa. · "Todavía no hay servicios cargados" + CTA "Crear el primero". · Skeletons por card, nunca spinner de página completa. · Card individual muestra "no se pudo cargar" + reintentar, sin tumbar el dashboard. · — · Todos los roles admin; el Operario no accede.

**AD-03 · Clientes (lista)**
Objetivo: encontrar un cliente en menos de 3 segundos. · Búsqueda con debounce 300 ms (nombre, CUIT, teléfono, dirección), tabla virtualizada, filtros por tipo/tag/estado, paginación server-side. · Nombre, tipo, ubicaciones, último servicio, próximo servicio, deuda. · Nuevo, ver, editar, archivar. · Ilustración + "Crear cliente". · Skeleton de 10 filas. · Banner de error con reintentar; la búsqueda previa queda visible. · Archivar pide confirmación y explica que no se borra. · `customer.read`.

**AD-04 · Cliente (detalle)**
Objetivo: contexto completo. · Header con datos + tabs: Ubicaciones · Servicios · Contratos · Pagos · Certificados · Notas. · Cuenta corriente, historial. · Nuevo servicio, nueva ubicación, nuevo contrato, registrar pago. · Por tab. · Tabs cargan lazy. · Por tab. · — · `customer.read`; acciones según permiso.

**AD-05 · Alta rápida de servicio** ← *pantalla más usada del sistema*
Objetivo: cargar un servicio mientras se habla por teléfono, sin salir de la pantalla. · Modal ancho de un paso. Combobox de cliente con creación inline. Selector de ubicación (o inline). Tipo de servicio, plagas (multi-chip), fecha objetivo (datepicker con atajos "hoy/mañana/esta semana"), ventana horaria, duración estimada (autocompletada por tipo), precio (autocompletado por lista vigente, editable solo con `service.price.override`), notas. · — · Guardar / Guardar y crear otro. · — · — · Errores de campo inline; el modal **nunca** se cierra perdiendo datos. Borrador en `sessionStorage`. · Sale sin guardar → confirmación. · `service.create`.

**AD-06 · Planificador** ← *pantalla técnicamente más compleja*
Objetivo: asignar el trabajo del día/semana. · Layout 2 columnas: panel izquierdo con servicios sin asignar (filtro por zona y fecha, chips arrastrables) + grilla central de operarios × horas. Toggle día/semana. Mapa colapsable a la derecha. · Duración, ventana horaria, conflictos. · Drag & drop, click para detalle, "crear ruta", "publicar". · "No hay servicios pendientes para esta semana". · Grilla con skeleton; los servicios se cargan aparte. · Si falla el guardado del drop, **el chip vuelve a su lugar con animación** y aparece un toast — nunca queda en un estado visual mentiroso. · Publicar → modal resumen. · `route.update`; publicar requiere `route.publish`.

Detalle técnico: drag con `@dnd-kit` (no react-beautiful-dnd, sin mantenimiento). Actualización optimista con rollback. Autosave por debounce de 800 ms.

**AD-07 · Ruta (detalle)**
Objetivo: revisar y publicar. · Lista ordenable de stops, mapa con numeración, panel de validación (checklist de guards en verde/rojo), resumen de insumos requeridos vs. stock del operario. · Horarios estimados, distancia total. · Reordenar, agregar/quitar stop, publicar, despublicar, cancelar, duplicar. · "Ruta vacía — arrastrá servicios". · Skeleton. · Conflicto de versión → modal "modificada por X, recargar". · Publicar y despublicar piden confirmación con consecuencias explicadas. · `route.read`.

**AD-08 · Hoy (monitoreo en vivo)**
Objetivo: ver el estado del día de un vistazo. · Una fila por operario, chips por stop coloreados, barra de progreso, indicador de atraso. Auto-refresh 60 s con indicador "actualizado hace X". · Hora real vs. estimada. · Click en chip → panel lateral con fotos y datos en vivo. · "No hay rutas publicadas para hoy". · Primera carga con skeleton; refrescos silenciosos. · Si falla el refresh, se mantiene el último dato bueno con aviso "datos de hace 3 min". · — · `route.read.tenant`.

**AD-09 · Validación de cierres**
Objetivo: aprobar o rechazar rápido, en lote. · Cola tipo bandeja. Panel derecho con visor de fotos (grande), datos de la sesión, insumos, pago, firma. Atajos de teclado: `A` aprobar, `R` rechazar, `→` siguiente. · Duración, distancia GPS a la ubicación, variación de precio. · Aprobar, rechazar con motivo, aprobar todos los que cumplen. · "Nada pendiente de validar". · — · — · Rechazo exige motivo. · `service.validate`.

**AD-10 · Certificados**
Objetivo: emitir y firmar sin fricción. · Lista de `COMPLETED` sin certificado + lista de emitidos. Preview del PDF en panel. Selección múltiple. · Número correlativo, DT asignado. · Emitir, emitir en lote, firmar (DT), descargar, enviar por email, copiar link WhatsApp, anular. · "No hay certificados pendientes". · Generación en background con toast de progreso. · Si falla la generación, queda en cola con reintento. · Anular exige motivo y advierte que es irreversible. · `certificate.issue` / `certificate.sign`.

**AD-11 · Inventario**
Objetivo: saber qué hay y dónde. · Tabla producto × ubicación de stock. Filtro por ubicación. Alertas de mínimo y de vencimiento. · Stock por lote con vencimiento. · Transferir, ajustar, reponer, ver movimientos. · — · — · — · Ajuste exige motivo y muestra el delta antes de confirmar. · `inventory.read`.

**AD-12 · Caja y rendiciones**
Objetivo: cerrar la plata del día sin discusión. · Cajas abiertas por operario con esperado en vivo. Cola de rendiciones `DECLARED`. Detalle con lista de pagos que componen el esperado. · Esperado / declarado / diferencia. · Aprobar, registrar diferencia con motivo, ajustar. · — · — · — · Diferencia mayor a la tolerancia configurada exige aprobación de Admin+ y motivo escrito. · `cash.read.tenant`.

**AD-13 · Reportes** · §P. Filtros de fecha/operario/cliente/tipo, export CSV y XLSX (background si >5.000 filas).

**AD-14 · Configuración** · Secciones: Empresa · Directores Técnicos · Tipos de servicio · Zonas · Listas de precios · Usuarios y roles · Parámetros operativos · Plantilla de certificado.

**AD-15 · Auditoría** · Timeline filtrable por entidad/actor/fecha, con diff antes/después. Solo lectura, sin excepción.

### G.3 Pantallas — OPERARIO MOBILE (PWA)

**OP-01 · Login**
Objetivo: entrar con guantes. · Campo usuario + teclado numérico grande de 6 dígitos para el PIN. Botón "recordarme en este dispositivo" activado por defecto. · — · Entrar. · — · Botón en loading. · "Usuario o PIN incorrecto". Sin conexión: si hay sesión previa válida en el dispositivo, **entra igual en modo offline**. · — · Público.

**OP-02 · Mi ruta de hoy** ← *pantalla principal*
Objetivo: saber a dónde ir ahora. · Header sticky: fecha, progreso "3 de 7", cobrado hoy, chip de sincronización. Lista de tarjetas de stop; la actual expandida y destacada; las hechas colapsadas con check verde. Botón inferior fijo contextual. · Hora estimada, cliente, dirección corta, chip de estado, monto. · Tap → detalle. Botón principal cambia según contexto ("Voy en camino" / "Llegué" / "Iniciar"). · "No tenés ruta para hoy" + fecha del próximo servicio. · Skeleton de 3 tarjetas. · Si no hay red y no hay caché: "Sin conexión y sin datos guardados. Conectate una vez para descargar tu ruta." · — · Operario asignado.

**OP-03 · Detalle del stop**
Objetivo: todo lo necesario para trabajar, sin scroll infinito. · Bloques colapsables: Cliente y contacto (botón llamar y WhatsApp) · Dirección + 2 botones de navegación · Cómo entrar / advertencias (perro, portero) en destaque amarillo · Servicio y plagas · Notas del admin · Historial (2 últimos) · Cobro esperado. · — · Llamar, navegar, llegué, iniciar. · — · — · — · — · Operario asignado.

**OP-04 · Ejecución**
Objetivo: registrar el trabajo sin pensar. · Cronómetro visible arriba. Secciones en acordeón con check de completitud: Fotos antes · Observaciones · Insumos · Fotos después · Pago · Firma. Botón inferior "Cerrar servicio" habilitado solo cuando el checklist cumple; si no, al tocarlo dice exactamente qué falta. · Tiempo transcurrido. · Cámara, seleccionar insumo, registrar pago, firmar, pausar. · — · — · Todo se guarda local; error de red no interrumpe. · Cerrar → hoja de resumen con confirmación. · `session.*`.

**OP-05 · Cámara / evidencia**
Objetivo: fotos útiles, livianas. · Cámara nativa vía `<input capture>` (no getUserMedia: mejor calidad y menos bugs en Android viejo). Grid de miniaturas con estado de subida por foto. Selector de categoría con chips grandes. · — · Sacar, categorizar, eliminar (solo si aún no se subió), reintentar. · "Sin fotos todavía". · Barra de progreso por foto. · Foto fallida se marca en rojo con botón reintentar; **nunca se pierde**. · Eliminar pide confirmación. · `evidence.upload`.

Técnico: compresión a WebP ~1600 px lado mayor, calidad 0.75, target <300 KB. EXIF de GPS strippeado. Blob en IndexedDB hasta confirmar subida.

**OP-06 · Insumos**
Objetivo: cargar consumo en 3 taps. · Lista de productos disponibles en *su* stock, con lo más usado arriba. Al elegir: lote (auto si es único), stepper de cantidad con unidades grandes, y cálculo automático concentrado↔mezcla. · Stock disponible visible. · Agregar, editar, quitar, "no tenía stock". · "Sin insumos cargados". · — · Si el stock quedaría negativo: advertencia clara, permite continuar (el consumo real es el que vale) y marca el movimiento para ajuste. · — · Operario asignado.

**OP-07 · Pago**
Objetivo: no equivocarse con la plata. · Monto esperado grande y precargado. Tres botones enormes de método. Si transferencia → cámara obligatoria. Si el monto se edita → motivo obligatorio. · Efectivo acumulado del día. · Registrar. · — · — · — · Confirmación con el monto en grande antes de guardar. · `payment.create`.

**OP-08 · Firma**
Objetivo: conformidad del cliente. · Canvas a pantalla completa en horizontal, botón limpiar, campo nombre y aclaración/DNI. Opción "el cliente no puede firmar" + motivo. · — · Guardar, limpiar, omitir con motivo. · — · — · — · — · Operario asignado.

**OP-09 · Cierre de jornada y rendición**
Objetivo: rendir sin discusión. · Resumen del día: servicios, tiempo, efectivo esperado desglosado por servicio. Campo "efectivo que entrego". Si difiere → motivo obligatorio. · — · Rendir. · — · — · Se encola offline. · Confirmación con el monto en grande. · `cash.close.own`.

**OP-10 · Estado de sincronización**
Objetivo: confianza. Accesible desde el chip del header. · Lista de acciones pendientes con su estado (pendiente / enviando / error), botón "reintentar todo", último sync exitoso. · — · Reintentar. · "Todo sincronizado" con check verde. · — · Errores con explicación legible y opción de reintento. · — · Operario.

### G.4 Mejoras premium sugeridas

**UX de alta prioridad:**
1. **Ruta del día precargada la noche anterior.** Cuando el admin publica, se dispara push; el service worker descarga todo (datos + historial + fotos previas) mientras el celular está en wifi en la casa del operario. A la mañana, la app abre instantánea y con datos aunque salga sin señal.
2. **Checklist por tipo de servicio, configurable.** Desratización pide cosas distintas que desinfección. Cargar el checklist desde la config del tenant convierte el producto en configurable sin tocar código, y es la base de la venta a otras empresas.
3. **"Modo apuro" en el planificador.** Un botón que autoasigna los servicios sin asignar al operario más cercano con hueco. No es optimización de rutas: es una heurística simple que resuelve el 80% de los días normales.

**Visuales:**
4. Color por operario, consistente en todo el sistema (chip, avatar, columna del planificador, línea del mapa). Reconocimiento sin leer.
5. Chips de estado con forma además de color (punto / anillo / check), para daltonismo y para el sol.

**Interacción que sorprende:**
6. **Deslizar el stop hacia la derecha = "Llegué".** Gesto de una mano, con el celular en la misma mano que sostiene la mochila. Con feedback háptico. Es el tipo de detalle que hace que el operario prefiera la app al cuaderno.

---
