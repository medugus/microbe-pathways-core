
-- ============================================================
-- Stage 2: Durable accessions + release packages (multi-tenant, RLS)
-- ============================================================

-- ---------- accessions ----------
CREATE TABLE public.accessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  accession_code TEXT NOT NULL,         -- e.g. "MB25-EF34GH"
  mrn TEXT,
  patient_name TEXT,
  stage TEXT NOT NULL,                  -- WorkflowStage value
  release_state TEXT NOT NULL,          -- ReleaseState value
  report_version INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL,                  -- full Accession document
  version INTEGER NOT NULL DEFAULT 1,   -- optimistic concurrency
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, accession_code)
);
CREATE INDEX idx_accessions_tenant_updated ON public.accessions(tenant_id, updated_at DESC);
CREATE INDEX idx_accessions_tenant_stage ON public.accessions(tenant_id, stage);
CREATE INDEX idx_accessions_tenant_mrn ON public.accessions(tenant_id, mrn);

CREATE TRIGGER trg_accessions_updated_at
  BEFORE UPDATE ON public.accessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- release_packages (append-only) ----------
CREATE TABLE public.release_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  accession_id UUID NOT NULL REFERENCES public.accessions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  built_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  built_by UUID REFERENCES auth.users(id),
  body JSONB NOT NULL,
  rule_version JSONB NOT NULL,
  breakpoint_version TEXT NOT NULL,
  export_version TEXT NOT NULL,
  build_version TEXT NOT NULL,
  body_sha256 TEXT NOT NULL,            -- hex digest of canonical body
  UNIQUE (accession_id, version)
);
CREATE INDEX idx_release_pkg_tenant ON public.release_packages(tenant_id, built_at DESC);
CREATE INDEX idx_release_pkg_accession ON public.release_packages(accession_id, version DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.accessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_packages ENABLE ROW LEVEL SECURITY;

-- Accessions: tenant-scoped. Editing requires lab_tech or microbiologist.
CREATE POLICY "Members can read accessions in their tenant"
  ON public.accessions FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tech/micro can create accessions in their tenant"
  ON public.accessions FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_role(auth.uid(), tenant_id, 'lab_tech')
      OR public.has_role(auth.uid(), tenant_id, 'microbiologist')
      OR public.has_role(auth.uid(), tenant_id, 'admin')
    )
  );

CREATE POLICY "Tech/micro can update accessions in their tenant"
  ON public.accessions FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_role(auth.uid(), tenant_id, 'lab_tech')
      OR public.has_role(auth.uid(), tenant_id, 'microbiologist')
      OR public.has_role(auth.uid(), tenant_id, 'consultant')
      OR public.has_role(auth.uid(), tenant_id, 'admin')
    )
  );

-- No DELETE policy — accessions are not deleted; they progress through stages.

-- Release packages: append-only.
CREATE POLICY "Members can read release packages in their tenant"
  ON public.release_packages FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Micro/consultant can write release packages"
  ON public.release_packages FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_role(auth.uid(), tenant_id, 'microbiologist')
      OR public.has_role(auth.uid(), tenant_id, 'consultant')
      OR public.has_role(auth.uid(), tenant_id, 'admin')
    )
  );
-- No UPDATE/DELETE → frozen.

-- ============================================================
-- Audit triggers on accessions
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_accession_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'accession.create';
    v_old := NULL;
    v_new := jsonb_build_object(
      'stage', NEW.stage,
      'release_state', NEW.release_state,
      'report_version', NEW.report_version,
      'version', NEW.version
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'accession.update';
    v_old := jsonb_build_object(
      'stage', OLD.stage,
      'release_state', OLD.release_state,
      'report_version', OLD.report_version,
      'version', OLD.version
    );
    v_new := jsonb_build_object(
      'stage', NEW.stage,
      'release_state', NEW.release_state,
      'report_version', NEW.report_version,
      'version', NEW.version
    );
  END IF;

  INSERT INTO public.audit_event (
    tenant_id, actor_user_id, action, entity, entity_id, old_value, new_value
  ) VALUES (
    NEW.tenant_id,
    auth.uid(),
    v_action,
    'accession',
    NEW.id::text,
    v_old,
    v_new
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_accessions
  AFTER INSERT OR UPDATE ON public.accessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_accession_change();

CREATE OR REPLACE FUNCTION public.audit_release_package()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_event (
    tenant_id, actor_user_id, action, entity, entity_id, new_value
  ) VALUES (
    NEW.tenant_id,
    auth.uid(),
    'release.frozen',
    'release_package',
    NEW.accession_id::text || ':' || NEW.version::text,
    jsonb_build_object(
      'version', NEW.version,
      'body_sha256', NEW.body_sha256,
      'build_version', NEW.build_version
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_release_packages
  AFTER INSERT ON public.release_packages
  FOR EACH ROW EXECUTE FUNCTION public.audit_release_package();
