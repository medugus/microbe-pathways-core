-- Dispatch history (browser-phase, mock transport).
CREATE TABLE public.dispatch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  accession_id UUID NOT NULL REFERENCES public.accessions(id) ON DELETE CASCADE,
  release_package_id UUID NOT NULL REFERENCES public.release_packages(id) ON DELETE CASCADE,
  release_version INTEGER NOT NULL,
  receiver_name TEXT NOT NULL DEFAULT 'mock-receiver',
  format TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed','cancelled')),
  attempt_no INTEGER NOT NULL DEFAULT 1,
  parent_dispatch_id UUID REFERENCES public.dispatch_history(id) ON DELETE SET NULL,
  error_message TEXT,
  simulated_failure BOOLEAN NOT NULL DEFAULT false,
  payload_bytes INTEGER,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  requested_by UUID
);

CREATE INDEX idx_dispatch_history_accession ON public.dispatch_history(accession_id);
CREATE INDEX idx_dispatch_history_pkg ON public.dispatch_history(release_package_id);
CREATE INDEX idx_dispatch_history_parent ON public.dispatch_history(parent_dispatch_id);

ALTER TABLE public.dispatch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read dispatch history in their tenant"
  ON public.dispatch_history FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Lab/micro/consultant/admin can insert dispatch history"
  ON public.dispatch_history FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_role(auth.uid(), tenant_id, 'lab_tech'::app_role)
      OR has_role(auth.uid(), tenant_id, 'microbiologist'::app_role)
      OR has_role(auth.uid(), tenant_id, 'consultant'::app_role)
      OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
    )
  );

CREATE POLICY "Lab/micro/consultant/admin can update dispatch history"
  ON public.dispatch_history FOR UPDATE
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_role(auth.uid(), tenant_id, 'lab_tech'::app_role)
      OR has_role(auth.uid(), tenant_id, 'microbiologist'::app_role)
      OR has_role(auth.uid(), tenant_id, 'consultant'::app_role)
      OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
    )
  );

-- Audit trigger.
CREATE OR REPLACE FUNCTION public.audit_dispatch_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_action TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_dispatch_id IS NOT NULL THEN
      v_action := 'dispatch.retried';
    ELSE
      v_action := 'dispatch.requested';
    END IF;
    INSERT INTO public.audit_event (
      tenant_id, actor_user_id, action, entity, entity_id, new_value
    ) VALUES (
      NEW.tenant_id, NEW.requested_by, v_action, 'dispatch_history', NEW.id::text,
      jsonb_build_object(
        'accession_id', NEW.accession_id,
        'release_package_id', NEW.release_package_id,
        'release_version', NEW.release_version,
        'receiver_name', NEW.receiver_name,
        'format', NEW.format,
        'status', NEW.status,
        'attempt_no', NEW.attempt_no,
        'parent_dispatch_id', NEW.parent_dispatch_id
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'sent' THEN
      v_action := 'dispatch.sent';
    ELSIF NEW.status = 'failed' THEN
      v_action := 'dispatch.failed';
    ELSIF NEW.status = 'cancelled' THEN
      v_action := 'dispatch.cancelled';
    ELSE
      v_action := 'dispatch.status';
    END IF;
    INSERT INTO public.audit_event (
      tenant_id, actor_user_id, action, entity, entity_id, old_value, new_value, reason
    ) VALUES (
      NEW.tenant_id, NEW.requested_by, v_action, 'dispatch_history', NEW.id::text,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object(
        'status', NEW.status,
        'attempt_no', NEW.attempt_no,
        'release_version', NEW.release_version,
        'format', NEW.format
      ),
      NEW.error_message
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_audit_dispatch_history
  AFTER INSERT OR UPDATE ON public.dispatch_history
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_dispatch_history();