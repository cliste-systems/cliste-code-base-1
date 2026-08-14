-- Phase 3 retail build: teachable vs live-info gaps, store departments,
-- admin notes, and hardware warm-transfer go/no-go.

-- ---------------------------------------------------------------------------
-- cara_training_items.gap_kind
-- ---------------------------------------------------------------------------

alter table public.cara_training_items
  add column if not exists gap_kind text not null default 'learnable';

alter table public.cara_training_items
  drop constraint if exists cara_training_items_gap_kind_check;

alter table public.cara_training_items
  add constraint cara_training_items_gap_kind_check
  check (gap_kind in ('learnable', 'live_info'));

comment on column public.cara_training_items.gap_kind is
  'learnable = owner can teach Cara (FAQ/hours/department). live_info = stock, live prices, open-now — take a message, do not memorise.';

create index if not exists cara_training_items_org_kind_status_idx
  on public.cara_training_items (organization_id, gap_kind, status);

-- Backfill obvious live-info rows, then dismiss open ones so they stop
-- filling Knowledge Gaps (the 12/12 dismissals problem).
update public.cara_training_items
set gap_kind = 'live_info'
where gap_kind = 'learnable'
  and (
    gap_summary ~* '\b(in stock|out of stock|stock|availability|have you got|do you have|how much|price|specials?|offer(s)? today|open now|still open|wait time|how busy|queue)\b'
    or cara_question ~* '\b(in stock|out of stock|stock|availability|how much|price|specials?|open now|still open)\b'
  );

update public.cara_training_items
set
  status = 'dismissed',
  dismissed_at = coalesce(dismissed_at, now()),
  updated_at = now()
where gap_kind = 'live_info'
  and status in ('awaiting_answer', 'draft_ready');

-- ---------------------------------------------------------------------------
-- store_departments
-- ---------------------------------------------------------------------------

create table if not exists public.store_departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  uses_store_hours boolean not null default true,
  hours jsonb,
  transfer_number text,
  is_off_licence boolean not null default false,
  is_an_post boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_departments_name_not_blank check (length(trim(name)) > 0),
  constraint store_departments_name_len check (char_length(name) <= 80),
  constraint store_departments_transfer_len check (
    transfer_number is null or char_length(transfer_number) <= 32
  )
);

create index if not exists store_departments_organization_id_sort_idx
  on public.store_departments (organization_id, sort_order, created_at);

comment on table public.store_departments is
  'Store counters/desks Cara can name, with optional hours, transfer, Off-licence and An Post flags. Tenant-scoped.';

alter table public.store_departments enable row level security;

drop policy if exists "store_departments_select_same_org" on public.store_departments;
create policy "store_departments_select_same_org"
  on public.store_departments
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

drop policy if exists "store_departments_insert_same_org" on public.store_departments;
create policy "store_departments_insert_same_org"
  on public.store_departments
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "store_departments_update_same_org" on public.store_departments;
create policy "store_departments_update_same_org"
  on public.store_departments
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "store_departments_delete_same_org" on public.store_departments;
create policy "store_departments_delete_same_org"
  on public.store_departments
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

grant select, insert, update, delete on table public.store_departments to authenticated;

-- Seed from existing department chips (one row per unique name).
insert into public.store_departments (organization_id, name, sort_order)
select
  o.id,
  trim(both from chip),
  row_number() over (partition by o.id order by ord) - 1
from public.organizations o
cross join lateral unnest(
  string_to_array(replace(coalesce(o.agent_services_departments, ''), E'\n', ','), ',')
) with ordinality as chips(chip, ord)
where length(trim(both from chip)) > 0
  and not exists (
    select 1 from public.store_departments d where d.organization_id = o.id
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- organizations admin notes + warm-transfer hardware verdict
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists admin_notes text;

alter table public.organizations
  add column if not exists warm_transfer_hardware_status text not null default 'unknown';

alter table public.organizations
  drop constraint if exists organizations_warm_transfer_hardware_status_check;

alter table public.organizations
  add constraint organizations_warm_transfer_hardware_status_check
  check (warm_transfer_hardware_status in ('go', 'no_go', 'unknown'));

alter table public.organizations
  add column if not exists warm_transfer_hardware_notes text;

comment on column public.organizations.admin_notes is
  'Internal Cliste notes about this store. Not shown to the tenant.';

comment on column public.organizations.warm_transfer_hardware_status is
  'Hardware go/no-go for warm transfer (hold + enquiry + transfer on the store handset/PBX).';
