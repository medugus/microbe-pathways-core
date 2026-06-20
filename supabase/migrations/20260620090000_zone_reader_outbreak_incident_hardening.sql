-- Harden durable Zone Reader receipts and add persistent outbreak incident tracking.
-- Idempotent by design so preview deployments that missed earlier migrations
-- can recover without hand-editing Supabase.

-- ------------------------------------------------------------------
-- Zone Reader inbound queue: make the expected table shape explicit again
-- and force PostgREST to reload the schema cache after deployment.
-- ------------------------------------------------------------------

create table if not exists public.zone_reader_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  content_hash text not null,
  contract_version text not null,
  source_system text not null,
  accession_id text not null,
  accession_number text,
  isolate_id text not null,
  ast_panel_id text not null,
  read_at timestamptz not null,
  payload jsonb not null,
  status text not null default 'pending_review',
  received_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

alter table public.zone_reader_inbound_messages
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists content_hash text,
  add column if not exists contract_version text,
  add column if not exists source_system text,
  add column if not exists accession_id text,
  add column if not exists accession_number text,
  add column if not exists isolate_id text,
  add column if not exists ast_panel_id text,
  add column if not exists read_at timestamptz,
  add column if not exists payload jsonb,
  add column if not exists status text default 'pending_review',
  add column if not exists received_at timestamptz default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id);

update public.zone_reader_inbound_messages
set status = coalesce(nullif(status, ''), 'pending_review')
where status is null or status = '';

alter table public.zone_reader_inbound_messages
  alter column tenant_id set not null,
  alter column content_hash set not null,
  alter column contract_version set not null,
  alter column source_system set not null,
  alter column accession_id set not null,
  alter column isolate_id set not null,
  alter column ast_panel_id set not null,
  alter column read_at set not null,
  alter column payload set not null,
  alter column status set not null,
  alter column received_at set not null;

alter table public.zone_reader_inbound_messages
  drop constraint if exists zone_reader_inbound_messages_status_check;

alter table public.zone_reader_inbound_messages
  add constraint zone_reader_inbound_messages_status_check
  check (status in ('pending_review', 'accepted', 'rejected'));

create unique index if not exists zone_reader_inbound_tenant_hash_uidx
  on public.zone_reader_inbound_messages (tenant_id, content_hash);

create index if not exists zone_reader_inbound_review_idx
  on public.zone_reader_inbound_messages
  (tenant_id, accession_id, isolate_id, ast_panel_id, status, received_at desc);

alter table public.zone_reader_inbound_messages enable row level security;

drop policy if exists "Tenant members can read Zone Reader inbound messages"
  on public.zone_reader_inbound_messages;

create policy "Tenant members can read Zone Reader inbound messages"
  on public.zone_reader_inbound_messages
  for select
  to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

drop policy if exists "Authorized laboratory roles can review Zone Reader messages"
  on public.zone_reader_inbound_messages;

create policy "Authorized laboratory roles can review Zone Reader messages"
  on public.zone_reader_inbound_messages
  for update
  to authenticated
  using (
    public.has_role(auth.uid(), tenant_id, 'lab_tech'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'microbiologist'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'consultant'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
  )
  with check (
    public.has_role(auth.uid(), tenant_id, 'lab_tech'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'microbiologist'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'consultant'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
  );

grant select, update on public.zone_reader_inbound_messages to authenticated;
grant select, insert, update on public.zone_reader_inbound_messages to service_role;
revoke insert, delete on public.zone_reader_inbound_messages from anon, authenticated;

comment on table public.zone_reader_inbound_messages is
  'Durable inbound Zone Reader result receipts awaiting LIMS review. Zone Reader never has clinical release authority.';

-- ------------------------------------------------------------------
-- Outbreak incident register: live phenotypic signals can now be opened
-- into a persistent IPC/outbreak work item instead of disappearing when
-- the workspace is reset or the browser state changes.
-- ------------------------------------------------------------------

create table if not exists public.outbreak_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  candidate_pair_id text not null,
  status text not null default 'open',
  severity text not null,
  score integer not null,
  organism_code text not null,
  organism_display text not null,
  first_accession_id text not null,
  first_accession_number text,
  first_isolate_id text not null,
  second_accession_id text not null,
  second_accession_number text,
  second_isolate_id text not null,
  ward_summary text,
  reasons jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  handoff text not null,
  snapshots jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  opened_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_note text,
  updated_at timestamptz not null default now()
);

alter table public.outbreak_incidents
  drop constraint if exists outbreak_incidents_status_check;

alter table public.outbreak_incidents
  add constraint outbreak_incidents_status_check
  check (status in ('open', 'under_investigation', 'escalated', 'resolved', 'dismissed'));

alter table public.outbreak_incidents
  drop constraint if exists outbreak_incidents_severity_check;

alter table public.outbreak_incidents
  add constraint outbreak_incidents_severity_check
  check (severity in ('review', 'watch', 'high'));

create unique index if not exists outbreak_incidents_tenant_pair_uidx
  on public.outbreak_incidents (tenant_id, candidate_pair_id);

create index if not exists outbreak_incidents_status_idx
  on public.outbreak_incidents (tenant_id, status, severity, updated_at desc);

create index if not exists outbreak_incidents_accession_idx
  on public.outbreak_incidents (tenant_id, first_accession_id, second_accession_id);

alter table public.outbreak_incidents enable row level security;

drop policy if exists "Tenant members can read outbreak incidents"
  on public.outbreak_incidents;

create policy "Tenant members can read outbreak incidents"
  on public.outbreak_incidents
  for select
  to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

drop policy if exists "Authorized clinical roles can create outbreak incidents"
  on public.outbreak_incidents;

create policy "Authorized clinical roles can create outbreak incidents"
  on public.outbreak_incidents
  for insert
  to authenticated
  with check (
    public.is_tenant_member(auth.uid(), tenant_id)
    and (
      public.has_role(auth.uid(), tenant_id, 'lab_tech'::public.app_role)
      or public.has_role(auth.uid(), tenant_id, 'microbiologist'::public.app_role)
      or public.has_role(auth.uid(), tenant_id, 'consultant'::public.app_role)
      or public.has_role(auth.uid(), tenant_id, 'ipc'::public.app_role)
      or public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
    )
  );

drop policy if exists "Authorized clinical roles can update outbreak incidents"
  on public.outbreak_incidents;

create policy "Authorized clinical roles can update outbreak incidents"
  on public.outbreak_incidents
  for update
  to authenticated
  using (
    public.has_role(auth.uid(), tenant_id, 'microbiologist'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'consultant'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'ipc'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
  )
  with check (
    public.has_role(auth.uid(), tenant_id, 'microbiologist'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'consultant'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'ipc'::public.app_role)
    or public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
  );

drop trigger if exists trg_outbreak_incidents_updated_at on public.outbreak_incidents;
create trigger trg_outbreak_incidents_updated_at
  before update on public.outbreak_incidents
  for each row execute function public.update_updated_at_column();

grant select, insert, update on public.outbreak_incidents to authenticated;
grant select, insert, update on public.outbreak_incidents to service_role;
revoke delete on public.outbreak_incidents from anon, authenticated;

comment on table public.outbreak_incidents is
  'Persistent IPC/outbreak investigation register opened from phenotypic isolate-pair surveillance signals.';

notify pgrst, 'reload schema';
