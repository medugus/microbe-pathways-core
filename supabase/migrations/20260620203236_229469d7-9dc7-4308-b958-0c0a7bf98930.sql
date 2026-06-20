-- Lock down append_audit_event so only authenticated users can call it.
REVOKE EXECUTE ON FUNCTION public.append_audit_event(text, text, text, text, text, jsonb, jsonb, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_audit_event(text, text, text, text, text, jsonb, jsonb, text, text, text, jsonb) TO authenticated, service_role;

-- Defensively revoke any column-level read of receivers.bearer_token from anon/authenticated.
-- Reads go through the admin-only path; bearer tokens must never be exfiltrated via the Data API.
REVOKE SELECT (bearer_token) ON public.receivers FROM anon, authenticated;