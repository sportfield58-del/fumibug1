-- Extensiones de Postgres, tienen que existir antes de que cualquier tabla las use
-- (users.email es CITEXT desde la primera migración) — por eso esto va con timestamp
-- anterior a 20260821000000_init.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- users.email case-insensitive (§H.2)
CREATE EXTENSION IF NOT EXISTS btree_gist; -- exclusion constraint de price_lists (igualdad + rango)
