<!-- Extraído de docs/MASTER_SPEC.md · secciones §H -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## H. MODELO DE DATOS (PostgreSQL)

### H.1 Convenciones obligatorias

| Regla | Detalle |
|---|---|
| Nombres | `snake_case`, tablas en plural. |
| PK | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. Excepción: tablas de log usan `BIGSERIAL` (mejor localidad de índice en append masivo). |
| Tenant | **Toda** tabla de negocio lleva `tenant_id UUID NOT NULL REFERENCES tenants(id)`. Sin excepción. |
| Timestamps | `created_at`, `updated_at` `TIMESTAMPTZ NOT NULL DEFAULT now()`. **Siempre TIMESTAMPTZ**, jamás `TIMESTAMP`. |
| Soft delete | `archived_at TIMESTAMPTZ NULL`. No hay `DELETE` de negocio. |
| Auditoría de fila | `created_by`, `updated_by` `UUID REFERENCES users(id)`. |
| Concurrencia | `version INTEGER NOT NULL DEFAULT 1` en entidades editables por varios actores (`services`, `routes`, `route_stops`). |
| Dinero | `BIGINT` en **centavos**, más `currency CHAR(3) NOT NULL DEFAULT 'ARS'`. **Nunca `FLOAT`, nunca `NUMERIC` para montos operativos.** |
| Cantidades físicas | `NUMERIC(12,4)` (mililitros y gramos necesitan decimales). |
| Estados | `ENUM` de Postgres, no `VARCHAR` libre. |
| Índices | Todo FK tiene índice. Todo índice de tabla multi-tenant empieza por `tenant_id`. |
| Unicidad | Toda constraint de unicidad de negocio incluye `tenant_id`. |
| Geo | `lat NUMERIC(10,7)`, `lng NUMERIC(10,7)`. **No PostGIS en el MVP** (§R.3). |

### H.2 Tablas

#### `tenants`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(150) NOT NULL | |
| slug | VARCHAR(60) NOT NULL UNIQUE | subdominio futuro |
| legal_name, tax_id | VARCHAR | razón social, CUIT |
| health_authorization_number | VARCHAR(60) | **habilitación como empresa de control de plagas** |
| logo_url, address, phone, email | VARCHAR | |
| timezone | VARCHAR(40) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires' | |
| plan | tenant_plan NOT NULL DEFAULT 'CORE' | |
| status | tenant_status NOT NULL DEFAULT 'ACTIVE' | ACTIVE / SUSPENDED / TRIAL |
| settings | JSONB NOT NULL DEFAULT '{}' | parámetros operativos |

#### `users`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | **igual al `auth.users.id` de Supabase** |
| email | CITEXT NOT NULL UNIQUE | puede ser sintético para operarios |
| username | VARCHAR(40) | login corto de operarios |
| full_name, phone, avatar_url | | |
| color | CHAR(7) | identificación visual |
| is_active | BOOLEAN NOT NULL DEFAULT true | |
| last_login_at | TIMESTAMPTZ | |

`users` **no** lleva `tenant_id`: la relación va por `memberships` (un usuario puede estar en varios tenants).
Índices: `UNIQUE(email)`, `UNIQUE(username) WHERE username IS NOT NULL`.

#### `memberships`
`id`, `tenant_id` FK, `user_id` FK, `role_id` FK, `status` (ACTIVE/SUSPENDED), `joined_at`.
`UNIQUE(tenant_id, user_id)`. Índices en ambos FK.

#### `roles`
`id`, `tenant_id` FK, `key` VARCHAR(40), `name`, `is_system` BOOLEAN, `description`.
`UNIQUE(tenant_id, key)`. Roles semilla: `owner`, `admin`, `supervisor`, `office`, `technician`, `technical_director`.

#### `permissions`
`key VARCHAR(60) PRIMARY KEY`, `resource`, `action`, `description`. **Tabla global, sin `tenant_id`** (es catálogo, no dato de negocio).

#### `role_permissions`
`role_id` FK, `permission_key` FK, `scope` ENUM(`own`,`team`,`tenant`) DEFAULT `tenant`.
`PRIMARY KEY(role_id, permission_key)`.

#### `technician_profiles`
Extensión de `users` para operarios y DT.
`user_id` PK/FK, `tenant_id`, `license_number` (libreta sanitaria / matrícula), `license_type` ENUM(`SANITARY_BOOK`,`TECHNICAL_DIRECTOR`), `license_expires_at` DATE, `signature_url` (solo DT), `vehicle_id` FK, `stock_location_id` FK.
Índice: `(tenant_id, license_expires_at)` para la alerta de vencimiento.

#### `customers`
`id`, `tenant_id`, `type` ENUM(`INDIVIDUAL`,`COMPANY`), `legal_name`, `trade_name`, `tax_id`, `tax_condition` ENUM, `payment_terms` ENUM(`CASH`,`ACCOUNT`,`CONTRACT`), `credit_limit_cents`, `notes`, `tags TEXT[]`, `archived_at`.
Índices: `(tenant_id, archived_at)`, `(tenant_id, tax_id)`, y **búsqueda full-text**: `GIN (to_tsvector('spanish', coalesce(legal_name,'')||' '||coalesce(trade_name,'')))`.

#### `customer_contacts`
`id`, `tenant_id`, `customer_id` FK, `name`, `role` ENUM(`OWNER`,`ONSITE`,`BILLING`), `phone`, `email`, `is_primary`.

#### `service_locations`
| Campo | Tipo | Notas |
|---|---|---|
| id, tenant_id, customer_id | | |
| label | VARCHAR(80) | "Sucursal Centro" |
| address_line, city, province, postal_code | | |
| lat, lng | NUMERIC(10,7) | |
| geocode_status | ENUM(`PENDING`,`OK`,`MANUAL`,`FAILED`) | |
| access_notes | TEXT | cómo se entra |
| hazard_notes | TEXT | perro, químicos, altura |
| establishment_type | ENUM | HOME / GASTRO / FOOD_INDUSTRY / WAREHOUSE / SCHOOL / OFFICE / OTHER |
| area_sqm | NUMERIC(10,2) | |
| service_window_start / _end | TIME | ventana de atención |
| zone_id | FK `zones` | |
| archived_at | | |

Índices: `(tenant_id, customer_id)`, `(tenant_id, zone_id)`, `(tenant_id, lat, lng)`.

#### `service_types` (catálogo por tenant)
`id`, `tenant_id`, `key`, `name`, `default_duration_minutes`, `checklist JSONB`, `required_supply_ids UUID[]`, `certificate_template_key`.

#### `service_contracts`
`id`, `tenant_id`, `customer_id`, `service_type_id`, `recurrence` JSONB (`{freq:'MONTHLY', interval:1, byMonthDay:15}`), `starts_on` DATE, `ends_on` DATE NULL, `auto_renew` BOOLEAN, `price_cents`, `billing_mode` ENUM(`PER_VISIT`,`MONTHLY_FEE`), `status` ENUM(`ACTIVE`,`PAUSED`,`CANCELLED`), `generate_ahead_days` INT DEFAULT 30, `last_generated_until` DATE.
Tabla puente `contract_locations(contract_id, service_location_id)`.

#### `services`
| Campo | Tipo | Notas |
|---|---|---|
| id, tenant_id | | |
| code | VARCHAR(20) NOT NULL | correlativo legible: `SRV-2026-00412` |
| customer_id, service_location_id, service_type_id | FK | |
| contract_id | FK NULL | origen |
| parent_service_id | FK NULL | revisita / continuación |
| origin | ENUM(`MANUAL`,`CONTRACT`,`WARRANTY`,`RESCHEDULE`,`PARTIAL_FOLLOWUP`) | |
| status | `service_status` NOT NULL | §D.3 |
| target_pests | TEXT[] | |
| scheduled_date | DATE | |
| window_start / window_end | TIME | |
| estimated_duration_minutes | INT | |
| required_technicians | SMALLINT NOT NULL DEFAULT 1 | **cuadrillas** |
| price_cents, currency | | |
| price_list_id | FK | de qué lista salió |
| is_warranty_visit | BOOLEAN DEFAULT false | precio 0, no cuenta como ingreso |
| warranty_until | DATE NULL | garantía que otorga este servicio |
| priority | ENUM(`LOW`,`NORMAL`,`HIGH`,`URGENT`) | |
| notes_internal, notes_for_technician | TEXT | |
| cancellation_reason | ENUM NULL | |
| cancelled_billable | BOOLEAN | |
| version | INT | |
| created_by, updated_by, created_at, updated_at | | |

Índices: `(tenant_id, status, scheduled_date)` ← el índice más usado del sistema; `(tenant_id, customer_id)`; `(tenant_id, service_location_id)`; `(tenant_id, contract_id)`; `UNIQUE(tenant_id, code)`.
Constraint: `CHECK (price_cents >= 0)`; `CHECK (window_start < window_end)`.
Unicidad de generación: `UNIQUE(contract_id, scheduled_date) WHERE contract_id IS NOT NULL` — hace idempotente al generador.

#### `routes`
`id`, `tenant_id`, `code`, `technician_id` FK users, `vehicle_id` FK NULL, `route_date` DATE NOT NULL, `status` `route_status`, `published_at`, `published_by`, `started_at`, `completed_at`, `notes`, `version`.
`UNIQUE(tenant_id, technician_id, route_date) WHERE status <> 'CANCELLED'` ← **un operario, una ruta por día**. Evita el desastre de dos rutas paralelas.
Índices: `(tenant_id, route_date, status)`, `(tenant_id, technician_id, route_date)`.

#### `route_stops`
`id`, `tenant_id`, `route_id` FK, `service_id` FK, `sequence` SMALLINT NOT NULL, `status` `stop_status`, `eta` TIME, `travel_minutes` SMALLINT, `en_route_at`, `arrived_at`, `arrival_lat`, `arrival_lng`, `arrival_accuracy_m`, `gps_status` ENUM(`OK`,`DENIED`,`UNAVAILABLE`,`TIMEOUT`), `distance_from_location_m` INT, `outcome_reason` ENUM NULL, `wasted_trip` BOOLEAN, `version`.
`UNIQUE(route_id, sequence) DEFERRABLE INITIALLY DEFERRED` ← **crítico**: sin `DEFERRABLE` no podés reordenar stops en una sola transacción.
`UNIQUE(service_id) WHERE status NOT IN ('CANCELLED','SKIPPED')` ← un servicio no puede estar activo en dos rutas.
Índices: `(tenant_id, route_id, sequence)`, `(tenant_id, status)`.

#### `service_sessions`
`id`, `tenant_id`, `service_id` FK, `route_stop_id` FK, `technician_id` FK, `status` ENUM(`OPEN`,`CLOSED`), `started_at`, `ended_at`, `start_lat/lng/accuracy_m`, `end_lat/lng/accuracy_m`, `paused_intervals` JSONB, `effective_minutes` INT GENERATED, `closure_checklist` JSONB, `client_signature_url`, `signer_name`, `signer_id_number`, `no_signature_reason` ENUM NULL, `technician_notes` TEXT, `reopened_count` SMALLINT DEFAULT 0, `client_event_id` UUID.
`UNIQUE(technician_id) WHERE status = 'OPEN'` ← **una sola sesión abierta por operario, garantizado por la DB**.
`UNIQUE(tenant_id, client_event_id)` ← idempotencia de sincronización offline.
Índices: `(tenant_id, service_id)`, `(tenant_id, technician_id, started_at)`.

#### `service_evidence`
`id`, `tenant_id`, `service_session_id` FK, `type` ENUM(`PHOTO`,`SIGNATURE`,`DOCUMENT`), `category` ENUM(`BEFORE`,`DURING`,`AFTER`,`FACADE`,`RECEIPT`,`ISSUE`), `storage_path` TEXT NOT NULL, `mime_type`, `size_bytes`, `width`, `height`, `sha256` CHAR(64), `taken_at` (device), `uploaded_at` (server), `lat`, `lng`, `accuracy_m`, `client_event_id` UUID.
`UNIQUE(tenant_id, client_event_id)`. Índice `(tenant_id, service_session_id)`.
Constraint: `CHECK (size_bytes <= 8388608)`.

#### `supplies` (catálogo de insumos)
`id`, `tenant_id`, `sku`, `name`, `category` ENUM(`INSECTICIDE`,`RODENTICIDE`,`DISINFECTANT`,`BAIT`,`TRAP`,`PPE`,`OTHER`), `active_ingredient`, `concentration`, **`registry_authority` ENUM(`ANMAT`,`SENASA`,`OTHER`)**, **`registry_number` VARCHAR(40)**, `purchase_unit` ENUM(`L`,`ML`,`KG`,`G`,`UNIT`), `application_unit`, `dilution_rate_ml_per_l` NUMERIC(8,3) NULL, `dose_per_sqm` NUMERIC(8,3) NULL, `reentry_hours` SMALLINT, `msds_url`, `unit_cost_cents`, `requires_lot_tracking` BOOLEAN DEFAULT true, `min_stock` NUMERIC(12,4), `archived_at`.
`UNIQUE(tenant_id, sku)`.

#### `stock_locations`
`id`, `tenant_id`, `type` ENUM(`WAREHOUSE`,`VEHICLE`), `name`, `technician_id` FK NULL, `vehicle_id` FK NULL, `is_active`.
`UNIQUE(tenant_id, technician_id) WHERE type='VEHICLE'`.

#### `supply_lots`
`id`, `tenant_id`, `supply_id` FK, `lot_code` VARCHAR(40), `expires_on` DATE, `received_at`, `unit_cost_cents`.
`UNIQUE(tenant_id, supply_id, lot_code)`. Índice `(tenant_id, expires_on)`.

#### `inventory` (saldo materializado)
`tenant_id`, `stock_location_id`, `supply_id`, `lot_id` NULL, `quantity` NUMERIC(12,4) NOT NULL DEFAULT 0, `updated_at`.
`PRIMARY KEY (stock_location_id, supply_id, lot_id)`.
**Es una proyección**: la verdad son los `inventory_movements`. Existe por performance y se actualiza en la misma transacción. Un job nocturno la reconcilia contra la suma de movimientos y alerta si difiere.

#### `inventory_movements` (append-only)
`id BIGSERIAL`, `tenant_id`, `stock_location_id`, `supply_id`, `lot_id`, `quantity_delta` NUMERIC(12,4) NOT NULL, `type` ENUM(`PURCHASE`,`TRANSFER_IN`,`TRANSFER_OUT`,`CONSUMPTION`,`RETURN`,`ADJUSTMENT`,`LOSS`,`EXPIRY_WRITE_OFF`), `reference_type`, `reference_id`, `reason`, `unit_cost_cents`, `performed_by`, `created_at`, `reversal_of_id` NULL.
**Sin `UPDATE` ni `DELETE`** — se revierte con un movimiento opuesto. Enforced por trigger.
Índices: `(tenant_id, supply_id, created_at)`, `(tenant_id, stock_location_id, created_at)`, `(reference_type, reference_id)`.

#### `service_supply_usage`
`id`, `tenant_id`, `service_session_id` FK, `supply_id` FK, `lot_id` FK NULL, `quantity_applied` NUMERIC(12,4), `unit`, `is_diluted_mix` BOOLEAN, `concentrate_equivalent` NUMERIC(12,4) ← **lo que realmente se descuenta del stock**, `application_method` ENUM(`SPRAY`,`GEL`,`BAIT_STATION`,`FOG`,`DUST`,`GRANULE`), `treated_area_sqm`, `inventory_movement_id` FK, `client_event_id` UUID.
`UNIQUE(tenant_id, client_event_id)`.

#### `payments`
`id`, `tenant_id`, `service_id` FK NULL, `customer_id` FK, `amount_cents` BIGINT NOT NULL, `currency`, `method` ENUM(`CASH`,`TRANSFER`,`MERCADOPAGO`,`CARD`,`CHECK`,`ACCOUNT`), `status` ENUM(`CONFIRMED`,`VOIDED`), `paid_at`, `received_by` FK users, `receipt_url`, `variance_reason` ENUM NULL, `reversal_of_id` FK NULL, `void_reason`, `client_event_id` UUID.
`UNIQUE(tenant_id, client_event_id)`.
`CHECK (amount_cents <> 0)`.
Índices: `(tenant_id, paid_at)`, `(tenant_id, service_id)`, `(tenant_id, received_by, paid_at)`, `(tenant_id, method, paid_at)`.

#### `cash_accounts`
`id`, `tenant_id`, `owner_user_id` FK, `type` ENUM(`TECHNICIAN`,`OFFICE`), `currency`, `is_active`.
`UNIQUE(tenant_id, owner_user_id, currency)`.

#### `cash_movements` (append-only)
`id BIGSERIAL`, `tenant_id`, `cash_account_id` FK, `amount_cents` BIGINT NOT NULL (signo: + ingreso, − egreso), `type` ENUM(`SERVICE_PAYMENT`,`EXPENSE`,`HANDOVER`,`ADJUSTMENT`,`OPENING_BALANCE`,`REVERSAL`), `reference_type`, `reference_id`, `closure_id` FK NULL, `description`, `performed_by`, `created_at`, `reversal_of_id`.
Sin `UPDATE`/`DELETE`, enforced por trigger.
Índices: `(tenant_id, cash_account_id, created_at)`, `(closure_id)`.

#### `cash_closures`
`id`, `tenant_id`, `cash_account_id` FK, `period_start`, `period_end`, `expected_cents` (calculado), `declared_cents` (operario), `received_cents` (admin), `difference_cents` GENERATED (`received - expected`), `status` ENUM(`OPEN`,`DECLARED`,`RECONCILED`,`DISPUTED`), `difference_reason`, `declared_by`, `declared_at`, `approved_by`, `approved_at`, `self_approved` BOOLEAN.
`UNIQUE(cash_account_id) WHERE status IN ('OPEN','DECLARED')` ← una sola rendición abierta por caja.

#### `certificates`
`id`, `tenant_id`, `number` INT NOT NULL, `formatted_number` VARCHAR(30) (`CERT-2026-00187`), `service_id` FK, `service_session_id` FK, `customer_id`, `service_location_id`, `technical_director_id` FK, `technician_id` FK, `status` ENUM(`DRAFT`,`ISSUED`,`SIGNED`,`VOIDED`), `snapshot` JSONB NOT NULL ← **congela todos los datos al emitir**, `pdf_storage_path`, `verification_token` UUID (para el QR público), `issued_at`, `signed_at`, `voided_at`, `void_reason`, `replaces_certificate_id` FK NULL.
`UNIQUE(tenant_id, number)`. Numeración correlativa por `SELECT ... FOR UPDATE` sobre un contador del tenant, no `MAX(number)+1`.

#### `price_lists` / `price_list_items`
`price_lists`: `id`, `tenant_id`, `name`, `valid_from` DATE, `valid_to` DATE NULL, `is_default`.
`price_list_items`: `price_list_id`, `service_type_id`, `establishment_type` NULL, `price_cents`, `price_per_sqm_cents` NULL.
Constraint de no solapamiento de vigencias con `EXCLUDE USING gist (tenant_id WITH =, daterange(valid_from, valid_to) WITH &&)`.

#### `notifications`
`id`, `tenant_id`, `user_id` FK, `type`, `title`, `body`, `payload` JSONB, `read_at`, `sent_channels` TEXT[], `created_at`.
Índice `(tenant_id, user_id, read_at)`.

#### `push_subscriptions`
`id`, `tenant_id`, `user_id`, `endpoint` TEXT UNIQUE, `p256dh`, `auth`, `user_agent`, `last_seen_at`.

#### `audit_logs` (append-only, particionable)
`id BIGSERIAL`, `tenant_id`, `actor_user_id`, `actor_role`, `action` VARCHAR(60), `entity_type`, `entity_id`, `before` JSONB, `after` JSONB, `diff` JSONB, `severity` ENUM(`INFO`,`WARNING`,`CRITICAL`), `ip` INET, `user_agent`, `request_id` UUID, `created_at`.
Índices: `(tenant_id, created_at DESC)`, `(tenant_id, entity_type, entity_id)`, `(tenant_id, actor_user_id, created_at)`.
Particionado por rango mensual desde el día 1 (§R.5). Retención: 24 meses en línea, después a cold storage.

#### `sync_events` (idempotencia offline)
`client_event_id` UUID PK, `tenant_id`, `user_id`, `entity_type`, `entity_id`, `received_at`, `result` JSONB.
Permite responder el mismo resultado si el cliente reintenta. TTL de 30 días.

#### `zones`, `vehicles`, `monitoring_stations`, `station_readings`
`zones`: `id`, `tenant_id`, `name`, `color`.
`vehicles`: `id`, `tenant_id`, `plate`, `model`, `assigned_to`.
`monitoring_stations` (Fase 2): `id`, `tenant_id`, `service_location_id`, `number`, `type`, `map_x`, `map_y`, `installed_at`, `status`.
`station_readings` (Fase 2): `id`, `tenant_id`, `service_session_id`, `station_id`, `consumption_level` ENUM(`NONE`,`LOW`,`MEDIUM`,`HIGH`), `captures` INT, `replaced` BOOLEAN, `condition` ENUM, `notes`.

### H.3 Diagrama de relaciones (resumen)

```
tenants ──┬── memberships ── users ── technician_profiles
          │                    │
          ├── customers ──┬── customer_contacts
          │               └── service_locations ──┬── monitoring_stations
          │                        │              │
          ├── service_contracts ───┘              │
          │        │                              │
          │        ▼                              │
          ├──── services ──── route_stops ──── routes ── vehicles
          │        │               │                        │
          │        │               ▼                        │
          │        │        service_sessions ───┬── service_evidence
          │        │               │            ├── service_supply_usage ── supplies ── supply_lots
          │        │               │            └── station_readings
          │        │               │
          │        ├── payments ───┴──► cash_movements ── cash_accounts ── cash_closures
          │        │
          │        └── certificates
          │
          ├── stock_locations ── inventory ◄── inventory_movements
          ├── price_lists ── price_list_items
          └── audit_logs · notifications · sync_events
```

### H.4 Decisiones de modelado que hay que respetar

1. **`inventory` y `cash_movements` nunca se editan.** Todo error se corrige con un asiento inverso. Es la única forma de que el número cierre y de que la auditoría sirva.
2. **`certificates.snapshot` congela los datos.** Si mañana cambia el nombre del producto o el número de matrícula del DT, el certificado emitido no cambia. Un certificado es un documento histórico.
3. **Los índices únicos parciales hacen el trabajo pesado.** Una sesión abierta por operario, una ruta por operario por día, un stop activo por servicio, una rendición abierta por caja. Cuatro constraints que eliminan cuatro clases enteras de bug de concurrencia sin una línea de código de aplicación.
4. **`client_event_id` en toda entidad creable desde el campo.** Es lo que hace segura la sincronización offline.
5. **No hay tabla `roles` global.** Cada tenant tiene sus roles, aunque arranquen idénticos. Retrofittear esto en Fase 3 sería doloroso.

---
