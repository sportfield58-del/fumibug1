<!-- Extraído de docs/MASTER_SPEC.md · secciones §L, §M -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## L. OFFLINE / PWA

### L.1 La pregunta correcta

No es "¿debería funcionar offline?" sino "¿qué pasa si un operario trabaja 3 horas en un sótano sin señal?". En el conurbano bonaerense, en depósitos, en subsuelos y en zonas rurales, eso pasa **todos los días**. Si la app no funciona ahí, el operario vuelve al cuaderno y el proyecto fracasa.

Pero offline-first completo (sincronización bidireccional con resolución de conflictos, tipo CRDT o Replicache) es un proyecto en sí mismo. La respuesta correcta es **offline asimétrico**.

### L.2 Modelo: lectura cacheada + escritura encolada

**Offline (obligatorio en el MVP):**

| Funcionalidad | Mecanismo |
|---|---|
| Ver ruta del día completa | Precache del bundle `/field/today` al publicarse la ruta |
| Ver cliente, dirección, notas, historial | Incluido en el bundle |
| Ver catálogo de insumos y stock propio | Incluido en el bundle |
| Marcar en camino / llegué | Evento encolado |
| Iniciar y finalizar servicio | Evento encolado |
| Sacar y categorizar fotos | Blob en IndexedDB + evento encolado |
| Observaciones | Evento encolado |
| Registrar insumos | Evento encolado (validación de stock diferida) |
| Registrar pago | Evento encolado |
| Firma del cliente | Evento encolado |
| Marcar ausente / inaccesible | Evento encolado |
| Cerrar jornada y rendir | Evento encolado |

**Requiere conexión (aceptable):**
- Login inicial en un dispositivo nuevo
- Ver rutas de días distintos al actual
- Cualquier pantalla de admin
- Emisión de certificados
- Reportes

### L.3 Arquitectura de sincronización

```
Acción del usuario
   │
   ├─► Escritura optimista en IndexedDB (Dexie)  ──► la UI se actualiza YA
   │
   └─► push a outbox { clientEventId, type, payload, occurredAt, deps[], attempts }
            │
            ▼
   SyncEngine (background)
     · dispara con: online, foco de la app, timer 30 s, Background Sync API donde exista
     · procesa en orden causal (deps): sesión → insumos → fotos → pago → firma → cierre
     · POST /field/sync con lote de hasta 20 eventos
     · backoff exponencial 2^n con jitter, tope 5 min, máximo 10 intentos
     · éxito → marca aplicado y reconcilia con la respuesta del servidor
     · error 4xx no recuperable → marca FAILED, muestra al usuario, no reintenta a ciegas
     · error 5xx / red → reintenta
```

**Idempotencia (§I.R43):** cada evento lleva `clientEventId`. El servidor lo guarda en `sync_events`. Un reintento devuelve el resultado original. Sin esto, un backoff genera pagos duplicados.

**Fotos:** cola aparte, subida de a una para no saturar la conexión, con reanudación. La foto no se borra de IndexedDB hasta que el servidor confirma el hash.

**Conflictos:** el servidor gana en catálogos (precios, datos del cliente). El dispositivo gana en hechos ocurridos (el servicio se ejecutó, punto). Si el servidor detecta contradicción — servicio cancelado mientras el operario trabajaba — acepta y marca `conflict_flag` para que un humano decida (§I.R45).

**Reloj:** se guarda `occurred_at` del dispositivo y `recorded_at` del servidor. En cada sincronización exitosa se mide el offset y se guarda. Diferencia >15 min → `clock_skew_flag` visible para el admin. No se corrige silenciosamente.

### L.4 Service worker

- `next-pwa` / Workbox.
- **Scope `/campo`.** El admin no necesita service worker y complicaría los deploys.
- App shell: `CacheFirst` con versionado por build.
- `/field/today`: `NetworkFirst` con timeout de 3 s y fallback a caché.
- Storage de fotos ya subidas: `CacheFirst` con expiración de 7 días.
- API mutante: **nunca** cacheada. Va por el outbox.
- Aviso no intrusivo cuando hay versión nueva. **Nunca actualización forzada en medio de un servicio**: se aplica al cerrar el stop o al abrir la app.
- `beforeinstallprompt` capturado para ofrecer instalación en el momento correcto (después del primer servicio completado, no al entrar).

### L.5 Presupuesto de almacenamiento

Una jornada de 8 servicios × 6 fotos × 250 KB ≈ 12 MB. Con margen: **límite de 150 MB**. Purga automática de datos de más de 7 días ya sincronizados. Si se acerca al límite, avisa. Solicitar `navigator.storage.persist()` para que el navegador no evacúe la caché.

### L.6 Lo que NO se hace

- **No** offline para el admin. Complejidad enorme, valor nulo.
- **No** resolución automática de conflictos complejos. Un humano decide.
- **No** replicación completa de la base al dispositivo.
- **No** app nativa en el MVP. La PWA cubre todo lo necesario; si en producción aparecen límites reales (cámara, background), se evalúa Capacitor en Fase 3 reutilizando el mismo código.

---

## M. GPS Y MAPAS

### M.1 Lo que hay que asumir sobre el GPS

Ningún diseño que suponga GPS confiable sobrevive al primer día en campo:

- La precisión urbana entre edificios va de 5 m a 500 m.
- El usuario puede negar el permiso y no hay forma de obligarlo.
- iOS Safari exige HTTPS y contexto de interacción del usuario.
- **Una PWA no puede hacer tracking en segundo plano.** No existe Background Geolocation en la web. Si el operario minimiza la app, no hay posición. Cualquier promesa de "tracking en tiempo real" con una PWA es falsa.
- Las apps de fake location existen y funcionan.

Por eso: **el GPS es evidencia, no control**.

### M.2 MVP

| Funcionalidad | Implementación |
|---|---|
| Geocoding de direcciones | Google Geocoding API al crear la ubicación, resultado persistido. Corrección manual arrastrando un pin. **Nunca se geocodifica en tiempo real repetidamente** (costo). |
| Navegación | Links: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` y `https://waze.com/ul?ll={lat},{lng}&navigate=yes`. Cero costo, cero mantenimiento, el operario ya sabe usarlos. |
| Coordenada de llegada | `getCurrentPosition` con `enableHighAccuracy:true`, timeout 10 s, `maximumAge:0`. Se guarda `lat`, `lng`, `accuracy_m`, `gps_status`. |
| Coordenada de inicio/fin | Igual. |
| Distancia a la ubicación | Haversine calculado en el servidor. Se guarda `distance_from_location_m`. |
| Advertencia de geocerca | Si supera el radio configurado (default 300 m), advertencia no bloqueante. |
| Mapa en el admin | `@vis.gl/react-google-maps` con marcadores. Sin renderizado de rutas en el MVP. |

Costo estimado de Google Maps: con geocoding persistido y sin Distance Matrix, se queda cómodamente dentro del crédito mensual gratuito. **Poner un límite de gasto en la consola de Google desde el día 1** — es un error clásico y caro.

### M.3 Futuro (con disparador explícito)

| Funcionalidad | Cuándo | Por qué esperar |
|---|---|---|
| Distance Matrix para ETA de traslado | Fase 2 | Cuesta plata por request y el MVP se banca con `travel_minutes` manual. |
| Optimización automática de orden (TSP) | Fase 2/3 | Es un problema con ventanas horarias, habilidades y prioridades. Mal resuelto, el admin lo desactiva el segundo día. Antes hay que tener datos reales de duración de traslados. |
| Trazado de ruta en el mapa | Fase 2 | Cosmético hasta que haya optimización. |
| Tracking periódico | Fase 3, **solo con app nativa/Capacitor** | Imposible en PWA. Y tiene implicancias laborales y de privacidad que hay que conversar con la empresa antes de construirlo. |
| Geofencing automático (detectar llegada sin tap) | Fase 3 | Mismo problema: requiere background. |
| Mapa de calor de plagas por zona | Fase 3 | Diferencial comercial fuerte una vez que hay 2 años de datos. |

---
