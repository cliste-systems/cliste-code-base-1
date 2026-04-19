-- Phase 2: deposit-only Stripe charges + balance-due tracking.
--
-- Today `appointments.amount_cents` doubles as "what we charged via Stripe" and
-- "the price of the service". When a service requires a deposit, the up-front
-- charge is only a slice of the total, and the rest is collected in salon. We
-- need explicit columns so the dashboard can render a "Deposit paid · €X due
-- in salon" badge and so refund logic doesn't mistakenly treat the deposit as
-- the full amount.
--
-- Conventions:
--   * `amount_cents`        — the amount actually charged via Stripe (deposit
--                             OR full price). Existing webhook code keeps
--                             writing into this from `payment_intent.amount`.
--   * `service_total_cents` — the full price of the service at booking time
--                             (snapshot; doesn't move when the catalog is
--                             edited later).
--   * `deposit_cents`       — null when no deposit was required; otherwise the
--                             deposit amount we asked Stripe to collect.
--   * `balance_due_cents`   — generated column = max(0, service_total_cents -
--                             coalesce(amount_cents,0)). Surfaced on dashboard.
--   * payment_status now allows `'deposit_paid'`.

alter table public.appointments
  add column if not exists service_total_cents integer
    check (service_total_cents is null or service_total_cents >= 0);

alter table public.appointments
  add column if not exists deposit_cents integer
    check (deposit_cents is null or deposit_cents >= 0);

-- generated stored column gives us a no-cost dashboard read without recomputing
-- in app code. coalesce handles legacy rows where service_total_cents is null.
alter table public.appointments
  add column if not exists balance_due_cents integer
    generated always as (
      case
        when service_total_cents is null then 0
        else greatest(0, service_total_cents - coalesce(amount_cents, 0))
      end
    ) stored;

alter table public.appointments
  drop constraint if exists appointments_payment_status_check;

alter table public.appointments
  add constraint appointments_payment_status_check
  check (
    payment_status is null
    or payment_status in (
      'unpaid',
      'pending',
      'paid',
      'deposit_paid',
      'refunded',
      'failed'
    )
  );

comment on column public.appointments.service_total_cents is
  'Full service price snapshot at booking time. amount_cents may be smaller (deposit-only flow).';
comment on column public.appointments.deposit_cents is
  'When non-null, the deposit amount Stripe was asked to collect up front. Remainder is collected in salon.';
comment on column public.appointments.balance_due_cents is
  'Generated: service_total_cents - amount_cents (clamped at 0). Dashboard reads this directly.';
