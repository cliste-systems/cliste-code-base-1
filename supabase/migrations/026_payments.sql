-- Stripe Connect (salon = connected Express account) + per-appointment
-- payment tracking. Applied against the remote Supabase project via MCP on
-- 2026-04-17; this file checks the same change into git so fresh environments
-- stay in sync.

alter table public.organizations
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_onboarded_at timestamptz;

create unique index if not exists organizations_stripe_account_id_key
  on public.organizations (stripe_account_id)
  where stripe_account_id is not null;

alter table public.appointments
  add column if not exists payment_status text,
  add column if not exists amount_cents integer,
  add column if not exists currency text,
  add column if not exists platform_fee_cents integer,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_charge_id text,
  add column if not exists paid_at timestamptz;

alter table public.appointments
  drop constraint if exists appointments_payment_status_check;
alter table public.appointments
  add constraint appointments_payment_status_check
  check (
    payment_status is null
    or payment_status in ('unpaid','pending','paid','refunded','failed')
  );

create index if not exists appointments_stripe_session_idx
  on public.appointments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create index if not exists appointments_stripe_payment_intent_idx
  on public.appointments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

comment on column public.organizations.stripe_account_id is
  'Stripe Connect Express connected account id (acct_…). Null until the salon completes onboarding.';
comment on column public.appointments.payment_status is
  'null = no payment expected; pending = Checkout started; paid = Stripe webhook confirmed; refunded/failed as applicable.';
