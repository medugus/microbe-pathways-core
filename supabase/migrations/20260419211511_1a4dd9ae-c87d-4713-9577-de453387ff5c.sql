-- Stage 9: Persistent IPC signals
-- Tenant-wide table of detected IPC episodes (alert organisms, resistant
-- phenotypes, ward triggers). Populated by the server-side IPC evaluator
-- whenever a fresh (non-deduped) signal is detected. Provides an open-episode
-- dashboard for the IPC team across the whole tenant.

CREATE TABLE public.ipc_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  accession_id UUID NOT NULL REFERENCES public.accessions(id) ON DELETE CASCADE,
  isolate_id TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  organism_code TEXT,
  phenotypes JSONB NOT NULL DEFAULT '[]'::jsonb,
  message TEXT NOT NULL,
  timing TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  notify JSONB NOT NULL DEFAULT '[]'::jsonb,
  mrn TEXT,
  ward TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raised_by UUID,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_note TEXT,
  -- Dedupe key: one open row per (accession, isolate, rule)
  UNIQUE (accession_id, isolate_id, rule_code)
);

CREATE INDEX idx_ipc_signals_tenant_status ON public.ipc_signals (tenant_id, status, raised_at DESC);
CREATE INDEX idx_ipc_signals_mrn ON public.ipc_signals (tenant_id, mrn) WHERE mrn IS NOT NULL;
CREATE INDEX idx_ipc_signals_accession ON public.ipc_signals (accession_id);

ALTER TABLE public.ipc_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read ipc signals in their tenant"
  ON public.ipc_signals FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Lab/micro/ipc/admin can raise ipc signals"
  ON public.ipc_signals FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_role(auth.uid(), tenant_id, 'lab_tech'::app_role)
      OR has_role(auth.uid(), tenant_id, 'microbiologist'::app_role)
      OR has_role(auth.uid(), tenant_id, 'consultant'::app_role)
      OR has_role(auth.uid(), tenant_id, 'ipc'::app_role)
      OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
    )
  );

CREATE POLICY "IPC/admin can update ipc signals"
  ON public.ipc_signals FOR UPDATE TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_role(auth.uid(), tenant_id, 'ipc'::app_role)
      OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
      OR has_role(auth.uid(), tenant_id, 'consultant'::app_role)
    )
  );

-- Audit trigger: every raise / status change writes to audit_event
CREATE OR REPLACE FUNCTION public.audit_ipc_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_event (
      tenant_id, actor_user_id, action, entity, entity_id, new_value
    ) VALUES (
      NEW.tenant_id, NEW.raised_by, 'ipc.raised', 'ipc_signal', NEW.id::text,
      jsonb_build_object(
        'rule_code', NEW.rule_code,
        'organism_code', NEW.organism_code,
        'mrn', NEW.mrn,
        'ward', NEW.ward,
        'accession_id', NEW.accession_id
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_event (
      tenant_id, actor_user_id, action, entity, entity_id, old_value, new_value, reason
    ) VALUES (
      NEW.tenant_id,
      COALESCE(NEW.resolved_by, NEW.acknowledged_by, auth.uid()),
      'ipc.' || NEW.status,
      'ipc_signal', NEW.id::text,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'rule_code', NEW.rule_code),
      NEW.resolution_note
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_ipc_signal
AFTER INSERT OR UPDATE ON public.ipc_signals
FOR EACH ROW EXECUTE FUNCTION public.audit_ipc_signal();