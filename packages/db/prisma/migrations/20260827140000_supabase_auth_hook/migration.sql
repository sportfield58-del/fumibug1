-- Custom Access Token Hook de Supabase Auth — ADR 0003, docs/spec/11-seguridad.md §K.1.
--
-- El ADR describe "un Auth Hook inyecta tenant_id, role_key y permissions[] como claims
-- al emitir el token", pero nunca existió como función SQL real: apps/api/src/common/
-- guards/jwt.strategy.ts ya validaba estos claims (fail-closed, con el mensaje "Verificar
-- el Custom Access Token Hook de Supabase") pero no había nada del lado de Supabase que
-- los pusiera ahí. Sin esta función, TODO login falla con UNAUTHENTICATED.
--
-- Contrato de Supabase: recibe {user_id, claims} y devuelve {claims: {...}} — lo que sea
-- que no esté en el objeto devuelto, Supabase lo descarta del token final.
--
-- Asume un tenant por usuario (Fase 1, monoempresa — docs/spec/14-saas.md deja la puerta
-- abierta a multi-tenant por usuario en Fase 3, este hook tomaría entonces la membership
-- activa más reciente o la que corresponda al tenant del request; no hace falta resolverlo
-- ahora).
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  v_user_id uuid;
  v_tenant_id uuid;
  v_role_key text;
  v_permissions text[];
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  claims := event->'claims';

  SELECT m.tenant_id, r.key
    INTO v_tenant_id, v_role_key
  FROM memberships m
  JOIN roles r ON r.id = m.role_id
  WHERE m.user_id = v_user_id
    AND m.status = 'ACTIVE'
  ORDER BY m.joined_at DESC
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(rp.permission_key), '{}')
      INTO v_permissions
    FROM role_permissions rp
    WHERE rp.tenant_id = v_tenant_id
      AND rp.role_id = (SELECT m.role_id FROM memberships m WHERE m.user_id = v_user_id AND m.tenant_id = v_tenant_id LIMIT 1);

    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id));
    claims := jsonb_set(claims, '{role_key}', to_jsonb(v_role_key));
    claims := jsonb_set(claims, '{permissions}', to_jsonb(v_permissions));
  END IF;

  RETURN jsonb_build_object('claims', claims);
END;
$$;

-- Supabase Auth corre como el rol supabase_auth_admin — necesita poder ejecutar esta
-- función y leer las tablas que consulta (RLS con FORCE ROW LEVEL SECURITY no lo deja
-- pasar solo con el grant de ejecución; ver política explícita más abajo).
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

GRANT SELECT ON public.memberships TO supabase_auth_admin;
GRANT SELECT ON public.roles TO supabase_auth_admin;
GRANT SELECT ON public.role_permissions TO supabase_auth_admin;

-- FORCE ROW LEVEL SECURITY (migración anterior) bloquea incluso al dueño de la tabla sin
-- una policy explícita — supabase_auth_admin necesita ver todas las filas de todos los
-- tenants (el hook corre antes de que exista noción de "tenant actual" en la sesión).
CREATE POLICY supabase_auth_admin_read_memberships ON public.memberships
  FOR SELECT TO supabase_auth_admin USING (true);
CREATE POLICY supabase_auth_admin_read_roles ON public.roles
  FOR SELECT TO supabase_auth_admin USING (true);
CREATE POLICY supabase_auth_admin_read_role_permissions ON public.role_permissions
  FOR SELECT TO supabase_auth_admin USING (true);
