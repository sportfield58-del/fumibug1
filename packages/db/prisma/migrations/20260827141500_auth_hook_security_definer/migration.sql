-- Fix de la migración anterior (20260827140000): el hook fallaba en runtime
-- ("Error running hook URI: pg-functions://postgres/public/custom_access_token_hook")
-- porque la función corría con los privilegios de quien la LLAMA (supabase_auth_admin,
-- default SECURITY INVOKER) — ni el GRANT SELECT ni las policies de RLS alcanzaron para
-- que ese rol leyera las tablas de negocio. SECURITY DEFINER es el patrón que la propia
-- documentación de Supabase recomienda para estos hooks: la función corre con los
-- privilegios de quien la creó (el rol migrador, dueño de las tablas — bypassea RLS como
-- cualquier dueño de tabla), y solo necesita EXECUTE otorgado a supabase_auth_admin
-- (ya concedido en la migración anterior). search_path fijo por seguridad — una función
-- SECURITY DEFINER sin search_path explícito es vulnerable a search_path hijacking.
ALTER FUNCTION public.custom_access_token_hook(jsonb)
  SECURITY DEFINER
  SET search_path = public;
