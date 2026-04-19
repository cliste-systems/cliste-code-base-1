-- Phase 2 of the salon-dashboard parity push.
--
-- Adds the booking-rules layer Fresha/Treatwell-grade salons rely on:
--   * service_categories (so the storefront and dashboard can group services)
--   * services.category_id, buffer_before_min, buffer_after_min,
--     deposit_required, deposit_amount_cents, deposit_percent
--   * organizations.booking_rules (slot_interval, min_notice, max_advance,
--     cancellation_policy, allow_double_booking flag)
--   * appointments.cancel_reason, cancelled_at, cancelled_by
-- All new tables/columns are RLS-scoped via existing organization helpers.

-- ---------- service categories ------------------------------------------------

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id)
    on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_categories_org_idx
  on public.service_categories (organization_id, display_order);

create unique index if not exists service_categories_org_name_uq
  on public.service_categories (organization_id, lower(name));

alter table public.service_categories enable row level security;

drop policy if exists service_categories_select_own_org on public.service_categories;
create policy service_categories_select_own_org
  on public.service_categories
  for select
  using (organization_id = public.current_user_organization_id());

drop policy if exists service_categories_modify_own_org on public.service_categories;
create policy service_categories_modify_own_org
  on public.service_categories
  for all
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

-- public catalog can read categories (matches services policy)
drop policy if exists service_categories_select_public on public.service_categories;
create policy service_categories_select_public
  on public.service_categories
  for select
  to anon
  using (true);

-- ---------- services: category, buffers, deposits -----------------------------

alter table public.services
  add column if not exists category_id uuid
    references public.service_categories (id) on delete set null;

alter table public.services
  add column if not exists buffer_before_min integer not null default 0
    check (buffer_before_min >= 0 and buffer_before_min <= 240);

alter table public.services
  add column if not exists buffer_after_min integer not null default 0
    check (buffer_after_min >= 0 and buffer_after_min <= 240);

alter table public.services
  add column if not exists deposit_required boolean not null default false;

alter table public.services
  add column if not exists deposit_amount_cents integer
    check (deposit_amount_cents is null or deposit_amount_cents >= 0);

alter table public.services
  add column if not exists deposit_percent integer
    check (deposit_percent is null or (deposit_percent between 1 and 100));

create index if not exists services_org_category_idx
  on public.services (organization_id, category_id);

-- ---------- organization booking rules ---------------------------------------

alter table public.organizations
  add column if not exists booking_rules jsonb not null default '{}'::jsonb;

comment on column public.organizations.booking_rules is
  'Booking rules:
   {
     "slot_interval_min": 15,        -- 5/10/15/30/60 supported
     "min_notice_min": 60,            -- earliest gap before a booking can start
     "max_advance_days": 60,          -- how far ahead clients can book
     "cancellation_policy": "Free up to 24h before. Late cancels charged 50%.",
     "cancellation_window_hours": 24, -- enforcement
     "allow_double_booking": false,
     "auto_confirm_online": true
   }';

-- ---------- appointments: cancel audit + reason ------------------------------

alter table public.appointments
  add column if not exists cancel_reason text
    check (cancel_reason is null or length(cancel_reason) <= 200);

alter table public.appointments
  add column if not exists cancelled_at timestamptz;

alter table public.appointments
  add column if not exists cancelled_by uuid references auth.users (id)
    on delete set null;

-- ---------- shared updated_at trigger reuse ----------------------------------

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tg_service_categories_touch'
  ) then
    create trigger tg_service_categories_touch
      before update on public.service_categories
      for each row execute function public.tg_touch_updated_at();
  end if;
end $$;
