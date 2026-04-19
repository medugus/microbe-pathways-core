-- Receivers registry: per-tenant HTTP endpoints for outbound report delivery.
CREATE TABLE public.receivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('fhir', 'hl7', 'json')),
  bearer_token TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_receivers_tenant ON public.receivers(tenant_id);

ALTER TABLE public.receivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read receivers in their tenant"
ON public.receivers FOR SELECT TO authenticated
USING (tenant_id = current_tenant_id());

CREATE POLICY "Admins can create receivers in their tenant"
ON public.receivers FOR INSERT TO authenticated
WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Admins can update receivers in their tenant"
ON public.receivers FOR UPDATE TO authenticated
USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Admins can delete receivers in their tenant"
ON public.receivers FOR DELETE TO authenticated
USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE TRIGGER trg_receivers_updated_at
BEFORE UPDATE ON public.receivers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Append-only delivery log.
CREATE TABLE public.export_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  accession_id UUID NOT NULL REFERENCES public.accessions(id) ON DELETE CASCADE,
  release_package_id UUID NOT NULL REFERENCES public.release_packages(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.receivers(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('fhir', 'hl7', 'json')),
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  dispatched_by UUID,
  dispatched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_export_deliveries_tenant ON public.export_deliveries(tenant_id);
CREATE INDEX idx_export_deliveries_accession ON public.export_deliveries(accession_id);
CREATE INDEX idx_export_deliveries_dispatched_at ON public.export_deliveries(dispatched_at DESC);

ALTER TABLE public.export_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read deliveries in their tenant"
ON public.export_deliveries FOR SELECT TO authenticated
USING (tenant_id = current_tenant_id());

CREATE POLICY "Micro/consultant/admin can record deliveries"
ON public.export_deliveries FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = current_tenant_id()
  AND (
    has_role(auth.uid(), tenant_id, 'microbiologist'::app_role)
    OR has_role(auth.uid(), tenant_id, 'consultant'::app_role)
    OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
  )
);

-- Trigger: emit a release.dispatched audit row for every delivery insert.
CREATE OR REPLACE FUNCTION public.audit_export_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_event (
    tenant_id, actor_user_id, action, entity, entity_id, new_value
  ) VALUES (
    NEW.tenant_id,
    NEW.dispatched_by,
    'release.dispatched',
    'export_delivery',
    NEW.id::text,
    jsonb_build_object(
      'accession_id', NEW.accession_id,
      'receiver_id', NEW.receiver_id,
      'format', NEW.format,
      'http_status', NEW.http_status,
      'ok', (NEW.http_status BETWEEN 200 AND 299)
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_export_delivery
AFTER INSERT ON public.export_deliveries
FOR EACH ROW EXECUTE FUNCTION public.audit_export_delivery();