-- Defence-in-depth RLS pass.
--
-- These tables already have correct *application-level* access control
-- (everything writes via the service role from server actions / route
-- handlers), but a few were missing `enable row level security` or
-- explicit policies. If RLS is off, then a leaked anon/authenticated key
-- could read/write the table directly through PostgREST — bypassing every
-- check we have in TypeScript. Enabling RLS with no policies = default
-- deny for any non-service-role caller, which is exactly what we want
-- for service-role-only tables.
--
-- For each table, we either:
--   (a) enable RLS with NO policies and document service-role-only intent;
--   (b) enable RLS and add a narrow policy where the table is meant to
--       be readable by authenticated users (none in this migration).
--
-- All changes are idempotent.

-- ---------------------------------------------------------------------------
-- onboarding_applications — fraud / manual review queue
--
-- Holds review status, fraud score, reviewer notes. Read/written only by
-- the admin server actions. Never touched by tenant users directly.
-- ---------------------------------------------------------------------------

alter table public.onboarding_applications enable row level security;

comment on table public.onboarding_applications is
  'Onboarding fraud-review queue. SERVICE ROLE ONLY — no JWT policies on purpose. Admin actions in src/app/(admin)/admin/actions.ts use the admin client.';

-- ---------------------------------------------------------------------------
-- stripe_platform_prices — cached Stripe product/price IDs
--
-- Read by the public signup flow (to display tier prices) but the data is
-- already public via Stripe — no PII. Still RLS-protected because we don't
-- want anyone to write/edit price rows except the bootstrap script.
-- ---------------------------------------------------------------------------

alter table public.stripe_platform_prices enable row level security;

drop policy if exists "stripe_platform_prices_public_read"
  on public.stripe_platform_prices;
create policy "stripe_platform_prices_public_read"
  on public.stripe_platform_prices
  for select
  to anon, authenticated
  using (active = true);

comment on table public.stripe_platform_prices is
  'Cache of Stripe Product + Price IDs for Cliste platform billing tiers. Seed via npm run stripe:bootstrap. Public-readable (active rows only) for signup tier display; mutations via service role only.';

-- ---------------------------------------------------------------------------
-- public_booking_otp_challenges — short-lived OTP verification rows
--
-- Already RLS-on (migration 019) but no policies — confirm intent so a
-- future migration doesn't accidentally open it up. Service role only.
-- ---------------------------------------------------------------------------

comment on table public.public_booking_otp_challenges is
  'Public booking OTP challenges (one row per challenge). SERVICE ROLE ONLY — no JWT policies on purpose. Created/consumed by src/lib/public-booking-security.ts via the admin client. Auto-purged by the data-retention cron.';

-- ---------------------------------------------------------------------------
-- public_booking_rate_events — per-phone+org rate-limit log
-- ---------------------------------------------------------------------------

comment on table public.public_booking_rate_events is
  'Public booking rate-limit events (anti-abuse counter). SERVICE ROLE ONLY — no JWT policies on purpose. Auto-purged by the data-retention cron.';

-- ---------------------------------------------------------------------------
-- security_auth_events — long-term security audit log
-- ---------------------------------------------------------------------------

comment on table public.security_auth_events is
  'Security audit log (login successes/failures, admin unlocks, role changes, refunds, etc). SERVICE ROLE ONLY — no JWT policies on purpose. Read by support tools via admin client only. Retain indefinitely; consider field-level redaction in long-term archival.';
