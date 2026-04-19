
-- ============================================================
-- Stage 1: Foundation — tenants, profiles, roles, audit
-- ============================================================

-- Roles enum (NEVER store roles on profiles)
CREATE TYPE public.app_role AS ENUM (
  'lab_tech',
  'microbiologist',
  'consultant',
  'ams_pharmacist',
  'ipc',
  'admin'
);

-- Tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles (1:1 with auth.users), tenant-scoped
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);

-- User roles (separate table — prevents privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role)
);
CREATE INDEX idx_user_roles_user_tenant ON public.user_roles(user_id, tenant_id);

-- Append-only audit log
CREATE TABLE public.audit_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES auth.users(id),
  actor_label TEXT,            -- denormalised for historical clarity
  action TEXT NOT NULL,        -- e.g. 'workflow.transition', 'release.attempt'
  entity TEXT NOT NULL,        -- e.g. 'accession', 'isolate', 'ast_result'
  entity_id TEXT,              -- accession id / isolate id / etc.
  field TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant_at ON public.audit_event(tenant_id, at DESC);
CREATE INDEX idx_audit_entity ON public.audit_event(entity, entity_id);

-- ============================================================
-- SECURITY DEFINER helpers (avoid RLS recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND tenant_id = _tenant_id
  )
$$;

-- ============================================================
-- updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Auto-create profile + tenant on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_slug TEXT;
  v_tenant_name TEXT;
  v_display_name TEXT;
BEGIN
  v_tenant_slug := COALESCE(
    NEW.raw_user_meta_data->>'tenant_slug',
    'lab-' || substr(replace(NEW.id::text, '-', ''), 1, 10)
  );
  v_tenant_name := COALESCE(
    NEW.raw_user_meta_data->>'tenant_name',
    'Lab ' || substr(replace(NEW.id::text, '-', ''), 1, 6)
  );
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Find or create tenant
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = v_tenant_slug;
  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug)
    VALUES (v_tenant_name, v_tenant_slug)
    RETURNING id INTO v_tenant_id;

    -- First user in a new tenant becomes admin
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (NEW.id, v_tenant_id, 'admin');
  END IF;

  -- Always grant lab_tech as a baseline operator role
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, v_tenant_id, 'lab_tech')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (id, tenant_id, display_name, email)
  VALUES (NEW.id, v_tenant_id, v_display_name, NEW.email);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_event ENABLE ROW LEVEL SECURITY;

-- Tenants: members can read their tenant; admins can update
CREATE POLICY "Members can read their tenant"
  ON public.tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), id));

CREATE POLICY "Admins can update their tenant"
  ON public.tenants FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), id, 'admin'));

-- Profiles: user reads own + same-tenant members; user updates own
CREATE POLICY "Users can read profiles in their tenant"
  ON public.profiles FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- user_roles: users read their own; admins read+manage all in their tenant
CREATE POLICY "Users can read their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read tenant roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Admins can grant roles in their tenant"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), tenant_id, 'admin')
    AND public.is_tenant_member(user_id, tenant_id)
  );

CREATE POLICY "Admins can revoke roles in their tenant"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), tenant_id, 'admin'));

-- audit_event: tenant members can read; ONLY system (via SECURITY DEFINER) can insert; nobody updates/deletes
CREATE POLICY "Tenant members can read audit"
  ON public.audit_event FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Authenticated users may insert their own actor audit rows for their tenant
CREATE POLICY "Members can write audit for their tenant"
  ON public.audit_event FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
  );
-- No UPDATE or DELETE policies → table is append-only for clients
