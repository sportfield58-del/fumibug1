-- Fumibug — todo lo que prisma/schema.prisma no puede expresar (ver header del schema).
-- docs/spec/08-modelo-datos.md §H, docs/spec/11-seguridad.md §K.4, docs/spec/09-reglas.md.

-- Extensiones (pgcrypto, citext, btree_gist) ya se crean en la migración anterior
-- (20260820235959_extensions), antes de que exista cualquier tabla que las use.

-- ============================================================================
-- 2. Índices únicos parciales — la defensa principal contra concurrencia (§H.4.3)
-- ============================================================================

-- R11 / §H.2 routes: un operario, una ruta activa por día.
CREATE UNIQUE INDEX routes_one_active_per_technician_per_day
  ON routes (tenant_id, technician_id, route_date)
  WHERE status <> 'CANCELLED';

-- §H.2 route_stops: un servicio no puede estar activo en dos rutas a la vez.
CREATE UNIQUE INDEX route_stops_one_active_per_service
  ON route_stops (service_id)
  WHERE status NOT IN ('CANCELLED', 'SKIPPED');

-- R3 / §H.2 service_sessions: una sola sesión abierta por operario, garantizado por DB.
CREATE UNIQUE INDEX service_sessions_one_open_per_technician
  ON service_sessions (technician_id)
  WHERE status = 'OPEN';

-- O.3.5 / §H.2 cash_closures: una sola rendición abierta por caja.
CREATE UNIQUE INDEX cash_closures_one_open_per_account
  ON cash_closures (cash_account_id)
  WHERE status IN ('OPEN', 'DECLARED');

-- §H.2 stock_locations: un solo stock de vehículo por operario.
CREATE UNIQUE INDEX stock_locations_one_vehicle_per_technician
  ON stock_locations (tenant_id, technician_id)
  WHERE type = 'VEHICLE';

-- Nota: users.username y services(contract_id, scheduled_date) NO necesitan índice parcial
-- acá — ya son UNIQUE normales en prisma/schema.prisma, porque Postgres nunca colisiona
-- NULLs en un UNIQUE, que es exactamente la semántica de "WHERE columna IS NOT NULL".

-- ============================================================================
-- 3. UNIQUE ... DEFERRABLE — crítico para reordenar stops en una transacción
-- ============================================================================

ALTER TABLE route_stops
  ADD CONSTRAINT route_stops_route_sequence_unique
  UNIQUE (route_id, sequence) DEFERRABLE INITIALLY DEFERRED;

-- ============================================================================
-- 4. EXCLUDE USING gist — vigencias de listas de precio no solapadas (§H.2 price_lists)
-- ============================================================================

ALTER TABLE price_lists
  ADD CONSTRAINT price_lists_no_overlapping_validity
  EXCLUDE USING gist (tenant_id WITH =, daterange(valid_from, valid_to) WITH &&);

-- ============================================================================
-- 5. CHECK constraints
-- ============================================================================

ALTER TABLE services ADD CONSTRAINT services_price_non_negative CHECK (price_cents >= 0);
ALTER TABLE services ADD CONSTRAINT services_window_valid CHECK (window_start < window_end);
ALTER TABLE payments ADD CONSTRAINT payments_amount_not_zero CHECK (amount_cents <> 0);
ALTER TABLE service_evidence ADD CONSTRAINT service_evidence_size_limit CHECK (size_bytes <= 8388608);

-- ============================================================================
-- 6. Búsqueda full-text de clientes (§H.2 customers)
-- ============================================================================

CREATE INDEX customers_fulltext_idx ON customers
  USING GIN (to_tsvector('spanish', coalesce(legal_name, '') || ' ' || coalesce(trade_name, '')));

-- ============================================================================
-- 7. Columnas generadas
-- ============================================================================

-- R10: tiempo efectivo = ended_at - started_at - Σ(pausas). paused_intervals es un array
-- JSONB de objetos {"start": "...", "end": "..."}. Un GENERATED column no admite
-- subqueries/funciones set-returning directamente, así que la suma de pausas se resuelve
-- en una función IMMUTABLE aparte (sí puede contener una subquery en su cuerpo).
CREATE OR REPLACE FUNCTION fumibug_paused_seconds(intervals jsonb)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    SUM(EXTRACT(EPOCH FROM (
      (elem ->> 'end')::timestamptz - (elem ->> 'start')::timestamptz
    )))::integer,
    0
  )
  FROM jsonb_array_elements(COALESCE(intervals, '[]'::jsonb)) AS elem
  WHERE elem ? 'start' AND elem ? 'end';
$$;

ALTER TABLE service_sessions
  ADD COLUMN effective_minutes INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN ended_at IS NULL THEN NULL
      ELSE GREATEST(
        0,
        (EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)::integer
          - (fumibug_paused_seconds(paused_intervals) / 60)
      )
    END
  ) STORED;

-- O.3.3: el esperado se calcula, nunca se guarda mutable — acá, la diferencia de cierre.
ALTER TABLE cash_closures
  ADD COLUMN difference_cents BIGINT GENERATED ALWAYS AS (received_cents - expected_cents) STORED;

-- ============================================================================
-- 8. Foreign keys de auditoría de fila que no se modelaron como relación de Prisma
--    (ver header de schema.prisma — evita ~30 back-relations sin uso real en User)
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers', 'service_contracts', 'services', 'routes', 'route_stops',
    'supplies', 'stock_locations', 'price_lists'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (created_by) REFERENCES users(id)',
      t, t || '_created_by_fkey'
    );
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (updated_by) REFERENCES users(id)',
      t, t || '_updated_by_fkey'
    );
  END LOOP;
END
$$;

ALTER TABLE certificates ADD CONSTRAINT certificates_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES users(id);
ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES users(id);
ALTER TABLE cash_closures ADD CONSTRAINT cash_closures_declared_by_fkey FOREIGN KEY (declared_by) REFERENCES users(id);
ALTER TABLE cash_closures ADD CONSTRAINT cash_closures_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id);
ALTER TABLE routes ADD CONSTRAINT routes_published_by_fkey FOREIGN KEY (published_by) REFERENCES users(id);

-- ============================================================================
-- 9. Triggers append-only — R42, ADR 0007. Rechazan UPDATE y DELETE sin excepción.
--    Toda corrección es un asiento inverso (reversal_of_id), nunca una edición.
-- ============================================================================

CREATE OR REPLACE FUNCTION fumibug_reject_update_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Fumibug: % es append-only, % no está permitido (R42 / ADR 0007). Corregí con un asiento inverso.',
    TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fumibug_reject_update_delete();

CREATE TRIGGER cash_movements_append_only
  BEFORE UPDATE OR DELETE ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION fumibug_reject_update_delete();

CREATE TRIGGER inventory_movements_append_only
  BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION fumibug_reject_update_delete();

-- ============================================================================
-- 10. Row Level Security — capa 2 de aislamiento multi-tenant (§K.4). Red de
--     seguridad: si la extensión de Prisma (capa 1) tuviera un bug, esto devuelve
--     cero filas en vez de datos ajenos. El rol de aplicación NO tiene BYPASSRLS
--     (sección 11 más abajo).
--
--     NULLIF(current_setting(...), '') y no current_setting(...) a secas: la primera vez
--     que un backend de Postgres referencia un GUC custom (sin extensión que lo declare)
--     lo registra con placeholder ''. Después de un SET LOCAL dentro de una transacción que
--     ya terminó, current_setting(..., true) devuelve '' en vez de NULL para ese backend —
--     no es "no seteado", es un valor vacío que igual explota al castear a ::uuid. Sin el
--     NULLIF, cualquier conexión reusada sin SET LOCAL en la transacción actual tira error
--     en lugar de simplemente no ver filas. Confirmado con test manual (ver PR).
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'memberships', 'roles', 'role_permissions', 'technician_profiles',
    'customers', 'customer_contacts', 'service_locations', 'service_types',
    'service_contracts', 'contract_locations', 'services', 'routes', 'route_stops',
    'service_sessions', 'service_evidence', 'supplies', 'stock_locations', 'supply_lots',
    'inventory', 'inventory_movements', 'service_supply_usage', 'payments', 'cash_accounts',
    'cash_movements', 'cash_closures', 'certificates', 'price_lists', 'price_list_items',
    'notifications', 'push_subscriptions', 'audit_logs', 'sync_events', 'zones', 'vehicles',
    'monitoring_stations', 'station_readings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END
$$;

-- tenants no tiene tenant_id (es la propia fila del tenant): policy por id.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- users y permissions quedan sin RLS por tenant_id a propósito: users no tiene tenant_id
-- (la relación es por membership, un usuario puede estar en varios tenants — §H.2) y
-- permissions es catálogo global del sistema. El acceso a users se filtra en la capa de
-- aplicación vía membership; no es el mismo patrón que el resto de las tablas.

-- ============================================================================
-- 11. Rol de aplicación sin BYPASSRLS — capa 2 de §K.4 / ADR 0004.
--     La contraseña NO se setea acá (CLAUDE.md §5: prohibido secretos en el repo).
--     Se configura una sola vez, fuera de git, con:
--       ALTER ROLE fumibug_app WITH PASSWORD '<secreto real, desde Railway/Supabase>';
--     Documentado en README.md — la connection string de runtime de apps/api usa este
--     rol, nunca el rol admin/postgres con el que corren las migraciones.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'fumibug_app') THEN
    CREATE ROLE fumibug_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO fumibug_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO fumibug_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fumibug_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fumibug_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fumibug_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO fumibug_app;

-- Defensa en profundidad: aunque el trigger de la sección 9 ya rechaza UPDATE/DELETE,
-- el rol de app directamente no tiene el privilegio sobre las tablas append-only.
REVOKE UPDATE, DELETE ON audit_logs, cash_movements, inventory_movements FROM fumibug_app;
