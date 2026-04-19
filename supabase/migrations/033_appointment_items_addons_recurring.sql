-- Phase 3 of the salon-dashboard parity push.
--
-- Adds the data shapes Fresha/Treatwell rely on for "real-world" salon
-- bookings beyond a single one-shot service:
--
--   * appointment_items   — multiple services per appointment (line items);
--                           keeps appointments.service_id as the *primary*
--                           item for backwards compatibility with all the
--                           current dashboard / agent / storefront code.
--   * service_addons      — optional add-ons attached to a service (e.g.
--                           "toner" for "cut & blow dry"). Customer can pick
--                           any/all of them at booking; each carries its own
--                           price + duration delta.
--   * services.processing_*  triple
--       processing_before_min / processing_min / processing_after_min —
--       lets the calendar show the gap between active stylist time and
--       processing time (colour develops, perm sits, etc.) so the chair
--       can be freed for another booking during processing.
--   * appointments.series_id + recurrence_rule for recurring bookings.
--
-- Backfill: for every existing appointment we insert exactly one
-- appointment_items row mirroring its current service_id + duration so the
-- new UI can lean on items without behaving differently for legacy data.

-- ---------- service add-ons --------------------------------------------------

create table if not exists public.service_addons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id)
    on delete cascade,
  /** When non-null, the add-on is only offered alongside this specific
      service. When null, it's a "global" add-on offered with any service.    */
  service_id uuid references public.services (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  price_cents integer not null default 0
    check (price_cents >= 0),
  duration_minutes integer not null default 0
    check (duration_minutes >= 0 and duration_minutes <= 480),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_addons_org_idx
  on public.service_addons (organization_id, display_order);
create index if not exists service_addons_service_idx
  on public.service_addons (service_id)
  where service_id is not null;

alter table public.service_addons enable row level security;

drop policy if exists service_addons_select_own_org on public.service_addons;
create policy service_addons_select_own_org
  on public.service_addons
  for select
  using (organization_id = public.current_user_organization_id());

drop policy if exists service_addons_modify_own_org on public.service_addons;
create policy service_addons_modify_own_org
  on public.service_addons
  for all
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists service_addons_select_public on public.service_addons;
create policy service_addons_select_public
  on public.service_addons
  for select
  to anon
  using (is_active = true);

-- ---------- services: processing-time triple --------------------------------

alter table public.services
  add column if not exists processing_before_min integer not null default 0
    check (processing_before_min >= 0 and processing_before_min <= 480);

alter table public.services
  add column if not exists processing_min integer not null default 0
    check (processing_min >= 0 and processing_min <= 480);

alter table public.services
  add column if not exists processing_after_min integer not null default 0
    check (processing_after_min >= 0 and processing_after_min <= 480);

comment on column public.services.processing_min is
  'Length of the hands-off processing window (e.g. colour developing). The chair is technically free for another booking during this time. Used by the calendar processing-stripe overlay.';

-- ---------- appointment line items ------------------------------------------

create table if not exists public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id)
    on delete cascade,
  appointment_id uuid not null references public.appointments (id)
    on delete cascade,
  /** Required when the item is a service. */
  service_id uuid references public.services (id) on delete restrict,
  /** Optional add-on; service_id can still point at the parent service. */
  addon_id uuid references public.service_addons (id) on delete set null,
  /** Stylist who's actually doing this item — can differ across items
      (e.g. cut by stylist A, colour by colourist B). */
  staff_id uuid references public.profiles (id) on delete set null,
  /** Snapshot at booking time, so editing the catalog later doesn't rewrite
      historic bookings. */
  name text not null check (length(trim(name)) between 1 and 120),
  duration_minutes integer not null default 0
    check (duration_minutes >= 0 and duration_minutes <= 600),
  price_cents integer not null default 0
    check (price_cents >= 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointment_items_appt_idx
  on public.appointment_items (appointment_id, display_order);
create index if not exists appointment_items_org_idx
  on public.appointment_items (organization_id);

alter table public.appointment_items enable row level security;

drop policy if exists appointment_items_select_own_org on public.appointment_items;
create policy appointment_items_select_own_org
  on public.appointment_items
  for select
  using (organization_id = public.current_user_organization_id());

drop policy if exists appointment_items_modify_own_org on public.appointment_items;
create policy appointment_items_modify_own_org
  on public.appointment_items
  for all
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

-- ---------- recurring series -------------------------------------------------

alter table public.appointments
  add column if not exists series_id uuid;

alter table public.appointments
  add column if not exists recurrence_rule text
    check (recurrence_rule is null or length(recurrence_rule) <= 200);

create index if not exists appointments_series_idx
  on public.appointments (series_id)
  where series_id is not null;

comment on column public.appointments.series_id is
  'Stable id grouping all appointments generated from a single recurring booking. NULL for one-off bookings.';
comment on column public.appointments.recurrence_rule is
  'iCalendar RRULE string (RFC 5545) describing the series. Stored on every instance for easy "edit this and following" behaviour.';

-- ---------- shared updated_at trigger reuse ---------------------------------

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tg_service_addons_touch'
  ) then
    create trigger tg_service_addons_touch
      before update on public.service_addons
      for each row execute function public.tg_touch_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'tg_appointment_items_touch'
  ) then
    create trigger tg_appointment_items_touch
      before update on public.appointment_items
      for each row execute function public.tg_touch_updated_at();
  end if;
end $$;

-- ---------- backfill: one item per existing appointment ---------------------
--
-- For every appointment that has a service_id and no items yet, insert a
-- mirror line item so the new UI can rely on items existing.

insert into public.appointment_items (
  organization_id, appointment_id, service_id, staff_id, name,
  duration_minutes, price_cents, display_order
)
select
  a.organization_id,
  a.id,
  a.service_id,
  a.staff_id,
  coalesce(s.name, 'Service'),
  greatest(0, extract(epoch from (a.end_time - a.start_time)) / 60)::int,
  coalesce(
    a.service_total_cents,
    a.amount_cents,
    case
      when s.price is not null then (s.price * 100)::int
      else 0
    end
  ),
  0
from public.appointments a
left join public.services s on s.id = a.service_id
where a.service_id is not null
  and not exists (
    select 1 from public.appointment_items ai
    where ai.appointment_id = a.id
  );
