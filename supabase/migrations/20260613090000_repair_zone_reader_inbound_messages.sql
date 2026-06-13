-- Repair/install durable Zone Reader receipts and force PostgREST to refresh.
-- This migration is intentionally idempotent so deployments that missed the
-- original migration can recover without manual table surgery.

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
  drop constraint if exists zone_reader_inbound_messages_status_check;

alter table public.zone_reader_inbound_messages
  add constraint zone_reader_inbound_messages_status_check
  check (status in ('pending_review', 'accepted', 'rejected'));

create unique index if not exists zone_reader_inbound_tenant_hash_uidx
  on public.zone_reader_inbound_messages (tenant_id, content_hash);

create index if not exists zone_reader_inbound_accession_idx
  on public.zone_reader_inbound_messages
  (tenant_id, accession_id, isolate_id, status, received_at desc);

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

notify pgrst, 'reload schema';
