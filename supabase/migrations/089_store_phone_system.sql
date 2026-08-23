-- Store phone system config + retail training support columns.

create table if not exists public.store_phone_systems (
  organization_id uuid primary key
    references public.organizations (id) on delete cascade,
  system_type text not null default 'unknown'
    check (system_type in ('pbx', 'sip_trunk', 'single_line', 'mobile_only', 'unknown')),
  vendor text,
  handset_count int check (handset_count is null or handset_count between 0 and 500),
  transfer_method text not null default 'none'
    check (transfer_method in ('sip_refer', 'dial_out', 'none')),
  warm_transfer_hardware_status text not null default 'unknown'
    check (warm_transfer_hardware_status in ('unknown', 'pending', 'go', 'blocked')),
  transfer_verified_at timestamptz,
  main_line_e164 text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.store_phone_systems is
  'Retail store PBX / line setup. Written from admin console; tenants read-only.';

alter table public.store_phone_systems enable row level security;

create policy "store_phone_systems_select_account"
  on public.store_phone_systems
  for select
  to authenticated
  using (
    organization_id in (
      select o.id from public.organizations o
      where o.account_id = public.current_user_account_id()
    )
  );

grant select on public.store_phone_systems to authenticated;
grant all on public.store_phone_systems to service_role;

alter table public.store_departments
  add column if not exists extension text
    check (extension is null or char_length(extension) <= 12);

alter table public.store_departments
  add column if not exists handles_text text;

alter table public.store_departments
  add column if not exists is_off_licence boolean not null default false;

alter table public.store_departments
  add column if not exists is_an_post boolean not null default false;

comment on column public.store_departments.extension is
  'PBX extension for this department. Only dialable when transfer is verified go.';

alter table public.organizations
  add column if not exists admin_notes text;

comment on column public.organizations.admin_notes is
  'Internal admin console notes — never compiled into custom_prompt.';

alter table public.cara_training_items
  add column if not exists gap_kind text not null default 'learnable'
    check (gap_kind in ('learnable', 'live_info'));

comment on column public.cara_training_items.gap_kind is
  'learnable gaps can be answered by staff; live_info is read-only (stock, prices, etc.).';

create index if not exists cara_training_items_org_gap_kind_occurrence_idx
  on public.cara_training_items (organization_id, gap_kind, occurrence_count desc, last_seen_at desc);

create table if not exists public.business_hours_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  label text not null,
  schedule jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists business_hours_overrides_org_expires_idx
  on public.business_hours_overrides (organization_id, expires_at desc);

comment on table public.business_hours_overrides is
  'Temporary opening-hours overrides (Christmas, refurb) — ignored after expires_at.';

alter table public.business_hours_overrides enable row level security;

create policy "business_hours_overrides_select_account"
  on public.business_hours_overrides
  for select
  to authenticated
  using (
    organization_id in (
      select o.id from public.organizations o
      where o.account_id = public.current_user_account_id()
    )
  );

grant select on public.business_hours_overrides to authenticated;
grant all on public.business_hours_overrides to service_role;
