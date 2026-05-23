
-- 1. Audit events: remove client INSERT policy. Triggers (SECURITY DEFINER) still write.
DROP POLICY IF EXISTS "Members can write audit for their tenant" ON public.audit_event;

-- 2. current_tenant_id: enforce single-row result.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$function$;

-- 3. Receivers bearer_token: revoke column-level read from API roles.
REVOKE SELECT ON public.receivers FROM anon, authenticated;
GRANT SELECT (id, tenant_id, name, endpoint_url, format, enabled, created_at, updated_at)
  ON public.receivers TO authenticated;
-- INSERT/UPDATE/DELETE still gated by RLS admin policies; column-level INSERT/UPDATE
-- for bearer_token remains available to authenticated so admins can set/rotate it.
GRANT INSERT (tenant_id, name, endpoint_url, format, bearer_token, enabled)
  ON public.receivers TO authenticated;
GRANT UPDATE (name, endpoint_url, format, bearer_token, enabled)
  ON public.receivers TO authenticated;
GRANT DELETE ON public.receivers TO authenticated;

-- 4. Lock down trigger-only SECURITY DEFINER helpers from the public API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_release_package() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_export_delivery() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_ams_approval() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_ipc_signal() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.ams_approvals_guard() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_accession_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_dispatch_history() FROM anon, authenticated, public;
-- has_role, is_tenant_member, current_tenant_id must stay EXECUTE-able by authenticated
-- because RLS policies invoke them under the caller's role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM anon, public;
