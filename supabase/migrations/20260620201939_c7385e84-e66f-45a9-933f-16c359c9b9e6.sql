-- Persistent, write-once audit hardening.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.audit_event
  ADD COLUMN IF NOT EXISTS accession_id TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS source_module TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS previous_chain_hash TEXT,
  ADD COLUMN IF NOT EXISTS chain_hash TEXT;

UPDATE public.audit_event
SET
  event_type = COALESCE(event_type, action),
  source_module = COALESCE(
    source_module,
    CASE
      WHEN entity IN ('ipc', 'ipc_signal') THEN 'ipc'
      WHEN entity = 'stewardship' THEN 'ams'
      WHEN entity = 'release_package' THEN 'release'
      WHEN entity = 'workflow' THEN 'workflow'
      ELSE 'lims'
    END
  ),
  accession_id = COALESCE(
    accession_id,
    CASE WHEN entity IN ('accession', 'release_package') THEN entity_id ELSE NULL END
  ),
  payload = COALESCE(
    payload,
    jsonb_build_object(
      'eventType', action, 'action', action, 'entity', entity, 'entityId', entity_id,
      'accessionId', CASE WHEN entity IN ('accession', 'release_package') THEN entity_id ELSE NULL END,
      'field', field, 'oldValue', old_value, 'newValue', new_value, 'reason', reason,
      'actorLabel', actor_label, 'actorUserId', actor_user_id, 'tenantId', tenant_id,
      'sourceModule', CASE
        WHEN entity IN ('ipc', 'ipc_signal') THEN 'ipc'
        WHEN entity = 'stewardship' THEN 'ams'
        WHEN entity = 'release_package' THEN 'release'
        WHEN entity = 'workflow' THEN 'workflow'
        ELSE 'lims'
      END,
      'at', at
    )
  )
WHERE event_type IS NULL OR source_module IS NULL OR payload IS NULL OR accession_id IS NULL;

UPDATE public.audit_event SET payload_hash = encode(digest(payload::text, 'sha256'), 'hex') WHERE payload_hash IS NULL;
UPDATE public.audit_event SET chain_hash = encode(digest(COALESCE(payload_hash, '') || id::text, 'sha256'), 'hex') WHERE chain_hash IS NULL;

ALTER TABLE public.audit_event
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN source_module SET NOT NULL,
  ALTER COLUMN payload SET NOT NULL,
  ALTER COLUMN payload_hash SET NOT NULL,
  ALTER COLUMN chain_hash SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_event_accession_at
  ON public.audit_event (tenant_id, accession_id, at DESC) WHERE accession_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_event_hash ON public.audit_event (tenant_id, payload_hash);

CREATE OR REPLACE FUNCTION public.infer_audit_source_module(_entity TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _entity IN ('ipc', 'ipc_signal') THEN 'ipc'
    WHEN _entity = 'stewardship' THEN 'ams'
    WHEN _entity = 'release_package' THEN 'release'
    WHEN _entity = 'workflow' THEN 'workflow'
    WHEN _entity = 'zone_reader' THEN 'zone_reader'
    ELSE 'lims'
  END
$$;

CREATE OR REPLACE FUNCTION public.prepare_audit_event_append()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_previous_chain_hash TEXT;
BEGIN
  NEW.event_type := COALESCE(NEW.event_type, NEW.action);
  NEW.source_module := COALESCE(NEW.source_module, public.infer_audit_source_module(NEW.entity));
  NEW.accession_id := COALESCE(NEW.accession_id,
    CASE WHEN NEW.entity IN ('accession', 'release_package') THEN NEW.entity_id ELSE NULL END);
  NEW.payload := COALESCE(NEW.payload,
    jsonb_build_object(
      'eventType', NEW.event_type, 'action', NEW.action, 'entity', NEW.entity, 'entityId', NEW.entity_id,
      'accessionId', NEW.accession_id, 'field', NEW.field, 'oldValue', NEW.old_value, 'newValue', NEW.new_value,
      'reason', NEW.reason, 'actorLabel', NEW.actor_label, 'actorUserId', NEW.actor_user_id,
      'tenantId', NEW.tenant_id, 'sourceModule', NEW.source_module, 'at', NEW.at
    ));
  NEW.payload_hash := encode(digest(NEW.payload::text, 'sha256'), 'hex');
  SELECT chain_hash INTO v_previous_chain_hash FROM public.audit_event
    WHERE tenant_id = NEW.tenant_id ORDER BY at DESC, id DESC LIMIT 1;
  NEW.previous_chain_hash := v_previous_chain_hash;
  NEW.chain_hash := encode(digest(COALESCE(v_previous_chain_hash, '') || NEW.payload_hash || NEW.id::text, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_audit_event_append ON public.audit_event;
CREATE TRIGGER trg_prepare_audit_event_append BEFORE INSERT ON public.audit_event
FOR EACH ROW EXECUTE FUNCTION public.prepare_audit_event_append();

CREATE OR REPLACE FUNCTION public.prevent_audit_event_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'audit_event is append-only'; END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_event_update ON public.audit_event;
CREATE TRIGGER trg_prevent_audit_event_update BEFORE UPDATE ON public.audit_event
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_event_mutation();

DROP TRIGGER IF EXISTS trg_prevent_audit_event_delete ON public.audit_event;
CREATE TRIGGER trg_prevent_audit_event_delete BEFORE DELETE ON public.audit_event
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_event_mutation();

CREATE OR REPLACE FUNCTION public.append_audit_event(
  p_action TEXT, p_entity TEXT, p_entity_id TEXT DEFAULT NULL, p_accession_id TEXT DEFAULT NULL,
  p_field TEXT DEFAULT NULL, p_old_value JSONB DEFAULT NULL, p_new_value JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL, p_actor_label TEXT DEFAULT NULL,
  p_source_module TEXT DEFAULT 'lims', p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id UUID; v_user_id UUID; v_event_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_tenant_id := public.current_tenant_id();
  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'authenticated tenant context required';
  END IF;
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN RAISE EXCEPTION 'audit action is required'; END IF;
  IF p_entity IS NULL OR length(trim(p_entity)) = 0 THEN RAISE EXCEPTION 'audit entity is required'; END IF;
  INSERT INTO public.audit_event (
    tenant_id, actor_user_id, actor_label, action, entity, entity_id, accession_id,
    field, old_value, new_value, reason, event_type, source_module, payload
  ) VALUES (
    v_tenant_id, v_user_id, p_actor_label, p_action, p_entity, p_entity_id, p_accession_id,
    p_field, p_old_value, p_new_value, p_reason, p_action,
    COALESCE(p_source_module, public.infer_audit_source_module(p_entity)),
    COALESCE(p_payload, '{}'::jsonb)
  ) RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_audit_event(
  TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, JSONB
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.prepare_audit_event_append() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_audit_event_mutation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.infer_audit_source_module(TEXT) FROM anon, public;

NOTIFY pgrst, 'reload schema';