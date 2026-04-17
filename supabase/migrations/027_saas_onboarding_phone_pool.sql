-- Cliste SaaS onboarding + phone pool + metering + tiered pricing.
--
-- Brings the platform from admin-driven provisioning to self-serve:
--   * organizations gains a lifecycle (status, onboarding_step) and pricing
--     state (plan_tier, application_fee_bps, launch_*, platform_subscription_id).
--   * phone_numbers is the pool (pre-bought IE DIDs + existing LiveKit numbers).
--   * usage_records is the per-call metering source for Stripe overage.
--   * onboarding_applications is the fraud/review queue for suspicious signups.
--   * stripe_platform_prices caches product/price IDs created by the bootstrap
--     script so runtime code doesn't re-query Stripe on every Checkout.
--
-- Safe to run on an existing project: every ADD COLUMN uses IF NOT EXISTS,
-- CREATE TABLE uses IF NOT EXISTS, and the backfill block only fills rows
-- that are still at the pre-SaaS defaults.

-- ---------------------------------------------------------------------------
-- organizations additions
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists status text not null default 'active'
    check (status in (
      'pending_verification',
      'onboarding',
      'active',
      'suspended',
      'churned'
    )),
  add column if not exists onboarding_step int not null default 0
    check (onboarding_step >= 0 and onboarding_step <= 10),
  add column if not exists plan_tier text not null default 'pro'
    check (plan_tier in ('starter','pro','business','enterprise')),
  add column if not exists application_fee_bps int not null default 100
    check (application_fee_bps >= 0 and application_fee_bps <= 2000),
  add column if not exists launch_tier text
    check (launch_tier is null or launch_tier in ('diy','remote','onsite')),
  add column if not exists launch_status text not null default 'not_started'
    check (launch_status in (
      'not_started',
      'scheduled',
      'in_progress',
      'completed'
    )),
  add column if not exists launch_scheduled_at timestamptz,
  add column if not exists launch_specialist_id uuid references auth.users(id) on delete set null,
  add column if not exists setup_fee_paid_cents int not null default 0
    check (setup_fee_paid_cents >= 0),
  add column if not exists platform_subscription_id text,
  add column if not exists platform_customer_id text,
  add column if not exists billing_period_start date,
  add column if not exists billing_interval text not null default 'month'
    check (billing_interval in ('month','year')),
  add column if not exists suspended_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists signup_ip inet,
  add column if not exists signup_user_agent text;

create index if not exists organizations_status_idx
  on public.organizations (status);
create index if not exists organizations_platform_subscription_idx
  on public.organizations (platform_subscription_id)
  where platform_subscription_id is not null;

comment on column public.organizations.status is
  'SaaS lifecycle: pending_verification → onboarding → active ↔ suspended / churned.';
comment on column public.organizations.plan_tier is
  'Subscription tier. Drives included minutes, overage rate, and default application_fee_bps.';
comment on column public.organizations.application_fee_bps is
  'Stripe Connect platform fee in basis points (100 = 1.00%). Tier-defaulted, admin overridable.';
comment on column public.organizations.launch_tier is
  'One-off setup service the salon bought: diy (€0) | remote (€149) | onsite (€349/449).';

-- ---------------------------------------------------------------------------
-- Default application_fee_bps from plan_tier — so support/admin only have to
-- touch one column when moving a salon between plans. Trigger fires on insert
-- and on plan_tier change; explicit application_fee_bps overrides still win.
-- ---------------------------------------------------------------------------

create or replace function public.organizations_sync_app_fee_bps()
returns trigger
language plpgsql
as $$
declare
  tier_default int;
begin
  tier_default := case new.plan_tier
    when 'starter'    then 150
    when 'pro'        then 100
    when 'business'   then 50
    when 'enterprise' then 25
    else 100
  end;

  if tg_op = 'INSERT' then
    -- Only override when the caller accepted the 100 default (i.e. didn't set one).
    if new.application_fee_bps = 100 and new.plan_tier <> 'pro' then
      new.application_fee_bps := tier_default;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.plan_tier is distinct from old.plan_tier
       and new.application_fee_bps = old.application_fee_bps then
      new.application_fee_bps := tier_default;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_sync_app_fee_bps on public.organizations;
create trigger organizations_sync_app_fee_bps
  before insert or update of plan_tier on public.organizations
  for each row execute function public.organizations_sync_app_fee_bps();

-- ---------------------------------------------------------------------------
-- phone_numbers — the pool
-- ---------------------------------------------------------------------------

create table if not exists public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  e164 text not null unique,
  country_code text not null default 'IE',
  provider text not null default 'twilio'
    check (provider in ('twilio','livekit','ported','manual')),
  provider_sid text,
  livekit_sip_trunk_id text,
  status text not null
    check (status in ('available','reserved','assigned','cooldown','porting_out')),
  organization_id uuid references public.organizations(id) on delete set null,
  assigned_at timestamptz,
  released_at timestamptz,
  cooldown_until timestamptz,
  monthly_cost_cents int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists phone_numbers_available_idx
  on public.phone_numbers (status, country_code)
  where status = 'available';
create index if not exists phone_numbers_org_idx
  on public.phone_numbers (organization_id);
create index if not exists phone_numbers_cooldown_idx
  on public.phone_numbers (cooldown_until)
  where status = 'cooldown';

comment on table public.phone_numbers is
  'Pool of provisioned DIDs. One row per number regardless of whether assigned, available, or in 30-day cooldown after churn.';

alter table public.phone_numbers enable row level security;

create policy "phone_numbers_select_same_org"
  on public.phone_numbers
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

-- ---------------------------------------------------------------------------
-- usage_records — per-call minute metering for Stripe overage
-- ---------------------------------------------------------------------------

create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_sid text,
  room_name text,
  caller_number text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  minutes_billable numeric(7,2),
  billing_period_start date not null,
  plan_tier_at_time text,
  plan_quota_at_time int,
  synced_to_stripe_at timestamptz,
  stripe_usage_record_id text,
  created_at timestamptz not null default now()
);

create index if not exists usage_records_org_period_idx
  on public.usage_records (organization_id, billing_period_start);
create index if not exists usage_records_unsynced_idx
  on public.usage_records (synced_to_stripe_at)
  where synced_to_stripe_at is null and ended_at is not null;
create index if not exists usage_records_call_sid_idx
  on public.usage_records (call_sid)
  where call_sid is not null;

comment on table public.usage_records is
  'One row per AI call. Agent writes on session start + end; nightly cron aggregates into Stripe metered subscription items.';

alter table public.usage_records enable row level security;

create policy "usage_records_select_same_org"
  on public.usage_records
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

-- ---------------------------------------------------------------------------
-- onboarding_applications — fraud / manual review queue
-- ---------------------------------------------------------------------------

create table if not exists public.onboarding_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  review_status text not null default 'auto_approved'
    check (review_status in ('auto_approved','pending_review','approved','rejected')),
  fraud_score int not null default 0,
  reasons text[],
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text
);

create index if not exists onboarding_apps_pending_idx
  on public.onboarding_applications (review_status)
  where review_status = 'pending_review';

-- ---------------------------------------------------------------------------
-- stripe_platform_prices — cache of product + price IDs created by the
-- bootstrap script (npm run stripe:bootstrap). Runtime Checkout code reads
-- from here instead of hardcoding env vars, so adding/renaming tiers is a
-- one-file change.
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_platform_prices (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,               -- 'pro_monthly', 'pro_annual', 'pro_overage', 'setup_remote', …
  plan_tier text,
  interval text,                          -- 'month' | 'year' | 'one_time' | 'metered'
  stripe_product_id text not null,
  stripe_price_id text not null,
  unit_amount_cents int,                  -- null for metered where applicable
  currency text not null default 'eur',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stripe_platform_prices is
  'Cache of Stripe Product + Price IDs for Cliste platform billing tiers. Seed via npm run stripe:bootstrap.';

-- ---------------------------------------------------------------------------
-- phone_number <-> organizations.phone_number cache keeper.
-- The agent (cliste-code-base-2) resolves calls by organizations.phone_number,
-- so we keep that column as a denormalised pointer to the primary assigned
-- pool row. This trigger fires whenever a pool row's status/organization_id
-- changes so the cache never drifts.
-- ---------------------------------------------------------------------------

create or replace function public.phone_numbers_sync_org_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'assigned'
     and new.organization_id is not null
     and (old.status is distinct from 'assigned'
          or old.organization_id is distinct from new.organization_id) then
    update public.organizations
      set phone_number = new.e164,
          updated_at = now()
      where id = new.organization_id;
  elsif tg_op = 'UPDATE'
        and old.status = 'assigned'
        and new.status is distinct from 'assigned'
        and old.organization_id is not null then
    update public.organizations
      set phone_number = null,
          updated_at = now()
      where id = old.organization_id
        and phone_number = old.e164;
  end if;
  return new;
end;
$$;

drop trigger if exists phone_numbers_sync_org_cache on public.phone_numbers;
create trigger phone_numbers_sync_org_cache
  after insert or update on public.phone_numbers
  for each row execute function public.phone_numbers_sync_org_cache();

-- ---------------------------------------------------------------------------
-- Backfill for rows that exist today.
-- Every pre-SaaS org is considered live and Pro-tier by default. Existing
-- organizations.phone_number values become phone_numbers rows with
-- provider='livekit' so the pool table is the single source of truth going
-- forward. Trigger above is intentionally AFTER — inserting here does not
-- overwrite the existing cache.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  update public.organizations
    set status = 'active',
        billing_period_start = coalesce(billing_period_start, current_date),
        launch_tier = coalesce(launch_tier, 'onsite'),
        launch_status = case
          when launch_status = 'not_started' and phone_number is not null
            then 'completed'
          else launch_status
        end
    where status = 'active';  -- defaulted in ADD COLUMN, same filter no-op if re-run

  for r in
    select id, phone_number
      from public.organizations
     where phone_number is not null
       and trim(phone_number) <> ''
  loop
    insert into public.phone_numbers (e164, country_code, provider, status, organization_id, assigned_at)
    values (
      r.phone_number,
      case when r.phone_number like '+353%' then 'IE' else 'US' end,
      'livekit',
      'assigned',
      r.id,
      now()
    )
    on conflict (e164) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Grants (service role bypasses RLS anyway; authenticated reads via RLS).
-- ---------------------------------------------------------------------------

grant select on table public.phone_numbers to authenticated;
grant select on table public.usage_records to authenticated;
