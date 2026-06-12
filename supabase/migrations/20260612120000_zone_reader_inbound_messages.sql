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
  status text not null default 'pending_review'
    check (status in ('pending_review', 'accepted', 'rejected')),
  received_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (tenant_id, content_hash)
);

create index if not exists zone_reader_inbound_accession_idx
  on public.zone_reader_inbound_messages (tenant_id, accession_id, received_at desc);

alter table public.zone_reader_inbound_messages enable row level security;

create policy "Tenant members can read Zone Reader inbound messages"
  on public.zone_reader_inbound_messages
  for select
  to authenticated
  using (public.is_tenant_member(auth.uid(), tenant_id));

create policy "Tenant admins can review Zone Reader inbound messages"
  on public.zone_reader_inbound_messages
  for update
  to authenticated
  using (public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role));

revoke insert, delete on public.zone_reader_inbound_messages
  from anon, authenticated;
