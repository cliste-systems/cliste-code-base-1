-- Staffed retail departments (deli, butcher, off-licence, etc.).

create table if not exists public.store_departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  phone_e164 text,
  hours jsonb,
  transfer_enabled boolean not null default true,
  cara_note text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_departments_org_active_sort_idx
  on public.store_departments (organization_id, active, sort_order);

comment on table public.store_departments is
  'Retail store departments with optional transfer numbers and hours overrides.';

alter table public.store_departments enable row level security;

create policy "store_departments_select_account"
  on public.store_departments
  for select
  to authenticated
  using (
    organization_id in (
      select o.id from public.organizations o
      where o.account_id = public.current_user_account_id()
    )
  );

grant select on public.store_departments to authenticated;
grant all on public.store_departments to service_role;
