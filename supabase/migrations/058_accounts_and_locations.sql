-- Multi-location: accounts (billing + team) with organizations as locations.
--
-- Backfills every existing org as a 1:1 account. Operational data stays on
-- organizations; billing moves to accounts.

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in (
      'pending_verification',
      'onboarding',
      'active',
      'suspended',
      'churned'
    )),
  plan_tier text not null default 'pro'
    check (plan_tier in ('starter', 'pro', 'business', 'enterprise')),
  application_fee_bps int not null default 100
    check (application_fee_bps >= 0 and application_fee_bps <= 2000),
  launch_tier text
    check (launch_tier is null or launch_tier in ('diy', 'remote', 'onsite')),
  launch_status text not null default 'not_started'
    check (launch_status in (
      'not_started',
      'scheduled',
      'in_progress',
      'completed'
    )),
  launch_scheduled_at timestamptz,
  launch_specialist_id uuid references auth.users (id) on delete set null,
  setup_fee_paid_cents int not null default 0
    check (setup_fee_paid_cents >= 0),
  platform_subscription_id text,
  platform_customer_id text,
  billing_period_start date,
  billing_interval text not null default 'month'
    check (billing_interval in ('month', 'year')),
  suspended_reason text,
  suspended_at timestamptz,
  signup_ip inet,
  signup_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_status_idx on public.accounts (status);
create index if not exists accounts_platform_subscription_idx
  on public.accounts (platform_subscription_id)
  where platform_subscription_id is not null;
create index if not exists accounts_platform_customer_idx
  on public.accounts (platform_customer_id)
  where platform_customer_id is not null;

comment on table public.accounts is
  'Billing and team boundary for one or more organization locations.';

-- ---------------------------------------------------------------------------
-- account_memberships
-- ---------------------------------------------------------------------------

create table if not exists public.account_memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  role text not null default 'member'
    check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id)
);

create index if not exists account_memberships_account_id_idx
  on public.account_memberships (account_id);

comment on table public.account_memberships is
  'Links auth users to accounts. Role is account-wide (all locations in MVP).';

-- ---------------------------------------------------------------------------
-- organizations → locations under an account
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists account_id uuid references public.accounts (id) on delete cascade,
  add column if not exists is_primary_location boolean not null default false;

create index if not exists organizations_account_id_idx
  on public.organizations (account_id);

-- ---------------------------------------------------------------------------
-- profiles: account + active location
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists account_id uuid references public.accounts (id) on delete cascade,
  add column if not exists active_organization_id uuid references public.organizations (id) on delete set null;

create index if not exists profiles_account_id_idx on public.profiles (account_id);
create index if not exists profiles_active_organization_id_idx
  on public.profiles (active_organization_id);

-- ---------------------------------------------------------------------------
-- Backfill: one account per existing organization
-- ---------------------------------------------------------------------------

insert into public.accounts (
  id,
  name,
  slug,
  status,
  plan_tier,
  application_fee_bps,
  launch_tier,
  launch_status,
  launch_scheduled_at,
  launch_specialist_id,
  setup_fee_paid_cents,
  platform_subscription_id,
  platform_customer_id,
  billing_period_start,
  billing_interval,
  suspended_reason,
  suspended_at,
  signup_ip,
  signup_user_agent,
  created_at,
  updated_at
)
select
  o.id,
  o.name,
  o.slug,
  coalesce(o.status, 'active'),
  coalesce(o.plan_tier, 'pro'),
  coalesce(o.application_fee_bps, 100),
  o.launch_tier,
  coalesce(o.launch_status, 'not_started'),
  o.launch_scheduled_at,
  o.launch_specialist_id,
  coalesce(o.setup_fee_paid_cents, 0),
  o.platform_subscription_id,
  o.platform_customer_id,
  o.billing_period_start,
  coalesce(o.billing_interval, 'month'),
  o.suspended_reason,
  o.suspended_at,
  o.signup_ip,
  o.signup_user_agent,
  o.created_at,
  o.updated_at
from public.organizations o
where o.account_id is null
on conflict (id) do nothing;

update public.organizations o
set
  account_id = o.id,
  is_primary_location = true
where o.account_id is null;

update public.profiles p
set
  account_id = o.account_id,
  active_organization_id = coalesce(p.active_organization_id, p.organization_id)
from public.organizations o
where o.id = p.organization_id
  and p.account_id is null;

insert into public.account_memberships (user_id, account_id, role)
select p.id, p.account_id, coalesce(p.role, 'member')
from public.profiles p
where p.account_id is not null
on conflict (user_id, account_id) do nothing;

-- Keep organization_id in sync with active location for legacy callers.
create or replace function public.profiles_sync_active_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active_organization_id is not null then
    new.organization_id := new.active_organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_active_organization_trg on public.profiles;
create trigger profiles_sync_active_organization_trg
  before insert or update of active_organization_id on public.profiles
  for each row
  execute function public.profiles_sync_active_organization();

update public.profiles
set active_organization_id = organization_id
where active_organization_id is null and organization_id is not null;

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_user_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.account_id
  from public.profiles p
  where p.id = auth.uid();
$$;

comment on function public.current_user_account_id() is
  'Account for the authenticated user; used for multi-location access.';

revoke all on function public.current_user_account_id() from public;
grant execute on function public.current_user_account_id() to authenticated;

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.active_organization_id, p.organization_id)
  from public.profiles p
  where p.id = auth.uid();
$$;

comment on function public.current_user_organization_id() is
  'Active dashboard location (organization) for the authenticated user.';

create or replace function public.user_can_access_organization(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    join public.profiles p on p.account_id = o.account_id
    where o.id = target_org_id
      and p.id = auth.uid()
  );
$$;

comment on function public.user_can_access_organization(uuid) is
  'True when target org belongs to the caller''s account.';

revoke all on function public.user_can_access_organization(uuid) from public;
grant execute on function public.user_can_access_organization(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- accounts RLS
-- ---------------------------------------------------------------------------

alter table public.accounts enable row level security;

drop policy if exists "accounts_select_member" on public.accounts;
create policy "accounts_select_member"
  on public.accounts
  for select
  to authenticated
  using (id = public.current_user_account_id());

drop policy if exists "accounts_update_admin" on public.accounts;
create policy "accounts_update_admin"
  on public.accounts
  for update
  to authenticated
  using (
    id = public.current_user_account_id()
    and exists (
      select 1
      from public.account_memberships m
      where m.user_id = auth.uid()
        and m.account_id = accounts.id
        and m.role = 'admin'
    )
  )
  with check (id = public.current_user_account_id());

-- ---------------------------------------------------------------------------
-- account_memberships RLS
-- ---------------------------------------------------------------------------

alter table public.account_memberships enable row level security;

drop policy if exists "account_memberships_select_same_account" on public.account_memberships;
create policy "account_memberships_select_same_account"
  on public.account_memberships
  for select
  to authenticated
  using (account_id = public.current_user_account_id());

-- ---------------------------------------------------------------------------
-- organizations: read all locations in account; update any in account
-- ---------------------------------------------------------------------------

drop policy if exists "organizations_select_same_org" on public.organizations;
create policy "organizations_select_account_locations"
  on public.organizations
  for select
  to authenticated
  using (account_id = public.current_user_account_id());

drop policy if exists "organizations_update_same_org" on public.organizations;
create policy "organizations_update_account_locations"
  on public.organizations
  for update
  to authenticated
  using (account_id = public.current_user_account_id())
  with check (account_id = public.current_user_account_id());

-- ---------------------------------------------------------------------------
-- profiles: teammates across the account
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_select_same_org" on public.profiles;
create policy "profiles_select_same_account"
  on public.profiles
  for select
  to authenticated
  using (account_id = public.current_user_account_id());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    and account_id = public.current_user_account_id()
  )
  with check (
    id = auth.uid()
    and account_id = public.current_user_account_id()
    and (
      active_organization_id is null
      or public.user_can_access_organization(active_organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Operational tables: read any location in account; write active location only
-- ---------------------------------------------------------------------------

drop policy if exists "call_logs_select_same_org" on public.call_logs;
create policy "call_logs_select_account"
  on public.call_logs
  for select
  to authenticated
  using (
    organization_id in (
      select o.id from public.organizations o
      where o.account_id = public.current_user_account_id()
    )
  );

drop policy if exists "call_logs_insert_same_org" on public.call_logs;
create policy "call_logs_insert_active_org"
  on public.call_logs
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "call_logs_update_same_org" on public.call_logs;
create policy "call_logs_update_active_org"
  on public.call_logs
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "call_logs_delete_same_org" on public.call_logs;
create policy "call_logs_delete_active_org"
  on public.call_logs
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

drop policy if exists "action_tickets_select_same_org" on public.action_tickets;
create policy "action_tickets_select_account"
  on public.action_tickets
  for select
  to authenticated
  using (
    organization_id in (
      select o.id from public.organizations o
      where o.account_id = public.current_user_account_id()
    )
  );

drop policy if exists "action_tickets_insert_same_org" on public.action_tickets;
create policy "action_tickets_insert_active_org"
  on public.action_tickets
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "action_tickets_update_same_org" on public.action_tickets;
create policy "action_tickets_update_active_org"
  on public.action_tickets
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "action_tickets_delete_same_org" on public.action_tickets;
create policy "action_tickets_delete_active_org"
  on public.action_tickets
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

drop policy if exists "services_select_same_org" on public.services;
create policy "services_select_account"
  on public.services
  for select
  to authenticated
  using (
    organization_id in (
      select o.id from public.organizations o
      where o.account_id = public.current_user_account_id()
    )
  );

drop policy if exists "services_insert_same_org" on public.services;
create policy "services_insert_active_org"
  on public.services
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "services_update_same_org" on public.services;
create policy "services_update_active_org"
  on public.services
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "services_delete_same_org" on public.services;
create policy "services_delete_active_org"
  on public.services
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());
