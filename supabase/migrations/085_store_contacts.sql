-- Store people: managers, duty managers, department heads, back office.

create table if not exists public.store_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  department_id uuid references public.store_departments (id) on delete set null,
  name text not null,
  role text not null
    check (role in (
      'store_manager', 'duty_manager', 'department_head', 'back_office', 'owner'
    )),
  phone_e164 text,
  email text,
  is_notification_target boolean not null default false,
  can_receive_transfers boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_contacts_org_active_idx
  on public.store_contacts (organization_id, active);

comment on table public.store_contacts is
  'Retail store contacts for alerts, transfers, and dashboard invites.';

alter table public.store_contacts enable row level security;

create policy "store_contacts_select_account"
  on public.store_contacts
  for select
  to authenticated
  using (
    organization_id in (
      select o.id from public.organizations o
      where o.account_id = public.current_user_account_id()
    )
  );

grant select on public.store_contacts to authenticated;
grant all on public.store_contacts to service_role;
