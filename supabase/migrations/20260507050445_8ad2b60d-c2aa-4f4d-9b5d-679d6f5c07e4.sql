
-- ============================================================
-- AMS Approvals normalisation
-- ============================================================

CREATE TABLE public.ams_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  accession_id uuid NOT NULL,
  ast_id text NOT NULL,
  isolate_id text NOT NULL,
  antibiotic_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  due_by timestamptz,
  clinical_justification text,
  denial_reason_code text,

  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by uuid,
  requested_role text,
  requested_note text,

  decided_at timestamptz,
  decided_by uuid,
  decided_role text,
  decided_note text,

  expired_at timestamptz,
  expired_by uuid,

  escalated boolean NOT NULL DEFAULT false,
  escalated_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ams_approvals_status_chk
    CHECK (status IN ('pending','approved','denied','expired')),
  CONSTRAINT ams_approvals_denial_reason_chk
    CHECK (denial_reason_code IS NULL OR denial_reason_code IN (
      'no_clinical_indication','alternative_available','duration_exceeds_policy',
      'insufficient_justification','duplicate_therapy','awaiting_culture','other'
    ))
);

CREATE INDEX ams_approvals_tenant_status_idx
  ON public.ams_approvals (tenant_id, status, due_by);
CREATE INDEX ams_approvals_accession_idx
  ON public.ams_approvals (accession_id);
CREATE INDEX ams_approvals_ast_idx
  ON public.ams_approvals (accession_id, ast_id);

ALTER TABLE public.ams_approvals ENABLE ROW LEVEL SECURITY;

-- ---------- RLS ----------

CREATE POLICY "Members can read ams_approvals in their tenant"
  ON public.ams_approvals FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Request: any clinical operator role; status must be pending; requested_by = auth.uid();
-- decision/expiry fields must be empty.
CREATE POLICY "Clinical roles can request ams_approvals"
  ON public.ams_approvals FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND status = 'pending'
    AND requested_by = auth.uid()
    AND decided_by IS NULL AND decided_at IS NULL
    AND expired_by IS NULL AND expired_at IS NULL
    AND (
      public.has_role(auth.uid(), tenant_id, 'lab_tech'::app_role)
      OR public.has_role(auth.uid(), tenant_id, 'microbiologist'::app_role)
      OR public.has_role(auth.uid(), tenant_id, 'consultant'::app_role)
      OR public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
    )
  );

-- Decide / expire / escalate: only consultant or admin.
CREATE POLICY "Consultant/admin can decide ams_approvals"
  ON public.ams_approvals FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_role(auth.uid(), tenant_id, 'consultant'::app_role)
      OR public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_role(auth.uid(), tenant_id, 'consultant'::app_role)
      OR public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
    )
  );

-- (No DELETE policy — deletes are forbidden.)

-- ---------- Transition / immutability trigger ----------

CREATE OR REPLACE FUNCTION public.ams_approvals_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lock terminal rows: once decided/denied/expired, no further updates allowed
  -- except the escalation flag toggling on a still-pending row (handled below).
  IF OLD.status IN ('approved','denied','expired') THEN
    RAISE EXCEPTION 'AMS approval % is locked (status=%)', OLD.id, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Allowed transitions from pending:
  IF NEW.status NOT IN ('pending','approved','denied','expired') THEN
    RAISE EXCEPTION 'invalid AMS approval status %', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Immutable identity / request payload.
  IF NEW.tenant_id      <> OLD.tenant_id
     OR NEW.accession_id <> OLD.accession_id
     OR NEW.ast_id       <> OLD.ast_id
     OR NEW.isolate_id   <> OLD.isolate_id
     OR NEW.antibiotic_code <> OLD.antibiotic_code
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.requested_at <> OLD.requested_at THEN
    RAISE EXCEPTION 'AMS approval request fields are immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  -- On decision, stamp decided_at/by from server context.
  IF NEW.status IN ('approved','denied') AND OLD.status = 'pending' THEN
    NEW.decided_at := COALESCE(NEW.decided_at, now());
    NEW.decided_by := COALESCE(NEW.decided_by, auth.uid());
    IF NEW.status = 'denied' AND NEW.denial_reason_code IS NULL THEN
      RAISE EXCEPTION 'denial_reason_code required when denying'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- On expiry, stamp expired_at/by.
  IF NEW.status = 'expired' AND OLD.status = 'pending' THEN
    NEW.expired_at := COALESCE(NEW.expired_at, now());
    NEW.expired_by := COALESCE(NEW.expired_by, auth.uid());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ams_approvals_guard_trg
  BEFORE UPDATE ON public.ams_approvals
  FOR EACH ROW EXECUTE FUNCTION public.ams_approvals_guard();

-- ---------- Audit trigger ----------

CREATE OR REPLACE FUNCTION public.audit_ams_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'ams.requested';
    INSERT INTO public.audit_event (
      tenant_id, actor_user_id, action, entity, entity_id, new_value
    ) VALUES (
      NEW.tenant_id, NEW.requested_by, v_action, 'ams_approval', NEW.id::text,
      jsonb_build_object(
        'accession_id', NEW.accession_id,
        'ast_id', NEW.ast_id,
        'antibiotic_code', NEW.antibiotic_code,
        'status', NEW.status,
        'due_by', NEW.due_by
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_action := 'ams.' || NEW.status;
    INSERT INTO public.audit_event (
      tenant_id, actor_user_id, action, entity, entity_id, old_value, new_value, reason
    ) VALUES (
      NEW.tenant_id,
      COALESCE(NEW.decided_by, NEW.expired_by, auth.uid()),
      v_action, 'ams_approval', NEW.id::text,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object(
        'status', NEW.status,
        'antibiotic_code', NEW.antibiotic_code,
        'accession_id', NEW.accession_id,
        'ast_id', NEW.ast_id,
        'denial_reason_code', NEW.denial_reason_code
      ),
      COALESCE(NEW.decided_note, NEW.requested_note)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_ams_approval_ins
  AFTER INSERT ON public.ams_approvals
  FOR EACH ROW EXECUTE FUNCTION public.audit_ams_approval();

CREATE TRIGGER audit_ams_approval_upd
  AFTER UPDATE ON public.ams_approvals
  FOR EACH ROW EXECUTE FUNCTION public.audit_ams_approval();
