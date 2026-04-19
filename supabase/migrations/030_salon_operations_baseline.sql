-- Phase 1 of the salon-dashboard parity push.
--
-- Adds the operational baseline a real salon needs:
--   * staff_working_hours        — per-stylist weekly schedule (lunch = a gap
--                                  between two rows on the same weekday)
--   * staff_time_off             — per-stylist holiday / sick / day-off blocks
--   * staff_services             — many-to-many: which stylist performs which
--                                  service. Empty set for an org = "everyone
--                                  does everything" (sane default for solo
--                                  salons so we don't break existing tenants).
--   * clients                    — first-class client entity, stable across
--                                  visits. appointments.client_id FKs to it,
--                                  but customer_name/phone/email stay on
--                                  appointments as a denormalised cache /
--                                  rolling-migration safety net.
--   * appointments.no_show       — extends the status check so the dashboard
--                                  can mark no-shows. Triggers maintain
--                                  clients.total_visits and
--                                  clients.no_show_count.
--
-- All tables are RLS-scoped to organization_id (defence-in-depth) and use
-- the existing public.current_user_organization_id() helper.

-- ---------------------------------------------------------------------------
-- 1. clients
-- ---------------------------------------------------------------------------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  phone_e164 text not null,
  email text,
  notes text,
  allergies text,
  total_visits int not null default 0,
  no_show_count int not null default 0,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_phone_format check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$')
);

create unique index if not exists clients_org_phone_uniq
  on public.clients (organization_id, phone_e164);

create index if not exists clients_org_name_idx
  on public.clients (organization_id, lower(name));

alter table public.clients enable row level security;

drop policy if exists "clients_select_same_org" on public.clients;
create policy "clients_select_same_org"
  on public.clients for select to authenticated
  using (organization_id = public.current_user_organization_id());

drop policy if exists "clients_insert_same_org" on public.clients;
create policy "clients_insert_same_org"
  on public.clients for insert to authenticated
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "clients_update_same_org" on public.clients;
create policy "clients_update_same_org"
  on public.clients for update to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "clients_delete_same_org" on public.clients;
create policy "clients_delete_same_org"
  on public.clients for delete to authenticated
  using (organization_id = public.current_user_organization_id());

grant select, insert, update, delete on table public.clients to authenticated;

comment on table public.clients is
  'First-class salon clients (stable identity across visits). appointments.client_id FKs here. total_visits / no_show_count maintained by trigger on appointments.';

-- ---------------------------------------------------------------------------
-- 2. staff_working_hours
-- ---------------------------------------------------------------------------

create table if not exists public.staff_working_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_working_hours_window check (closes_at > opens_at)
);

create index if not exists staff_working_hours_staff_idx
  on public.staff_working_hours (staff_id, weekday);

create index if not exists staff_working_hours_org_idx
  on public.staff_working_hours (organization_id);

alter table public.staff_working_hours enable row level security;

drop policy if exists "staff_working_hours_select_same_org" on public.staff_working_hours;
create policy "staff_working_hours_select_same_org"
  on public.staff_working_hours for select to authenticated
  using (organization_id = public.current_user_organization_id());

drop policy if exists "staff_working_hours_insert_same_org" on public.staff_working_hours;
create policy "staff_working_hours_insert_same_org"
  on public.staff_working_hours for insert to authenticated
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "staff_working_hours_update_same_org" on public.staff_working_hours;
create policy "staff_working_hours_update_same_org"
  on public.staff_working_hours for update to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "staff_working_hours_delete_same_org" on public.staff_working_hours;
create policy "staff_working_hours_delete_same_org"
  on public.staff_working_hours for delete to authenticated
  using (organization_id = public.current_user_organization_id());

grant select, insert, update, delete on table public.staff_working_hours to authenticated;

comment on table public.staff_working_hours is
  'Per-stylist weekly schedule. Multiple rows on the same weekday model a lunch break (Mon 10:00-13:00 + Mon 14:00-18:00 = 1pm lunch). Empty set for a staff member = "use organization business_hours".';

-- ---------------------------------------------------------------------------
-- 3. staff_time_off
-- ---------------------------------------------------------------------------

create table if not exists public.staff_time_off (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_time_off_range check (ends_at > starts_at)
);

create index if not exists staff_time_off_staff_idx
  on public.staff_time_off (staff_id, starts_at);

create index if not exists staff_time_off_org_range_idx
  on public.staff_time_off (organization_id, starts_at, ends_at);

alter table public.staff_time_off enable row level security;

drop policy if exists "staff_time_off_select_same_org" on public.staff_time_off;
create policy "staff_time_off_select_same_org"
  on public.staff_time_off for select to authenticated
  using (organization_id = public.current_user_organization_id());

drop policy if exists "staff_time_off_insert_same_org" on public.staff_time_off;
create policy "staff_time_off_insert_same_org"
  on public.staff_time_off for insert to authenticated
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "staff_time_off_update_same_org" on public.staff_time_off;
create policy "staff_time_off_update_same_org"
  on public.staff_time_off for update to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "staff_time_off_delete_same_org" on public.staff_time_off;
create policy "staff_time_off_delete_same_org"
  on public.staff_time_off for delete to authenticated
  using (organization_id = public.current_user_organization_id());

grant select, insert, update, delete on table public.staff_time_off to authenticated;

comment on table public.staff_time_off is
  'Per-stylist time off / holidays / sick days. Single dated ranges (recurring patterns deferred). Booking availability subtracts these from staff_working_hours.';

-- ---------------------------------------------------------------------------
-- 4. staff_services (eligibility)
-- ---------------------------------------------------------------------------

create table if not exists public.staff_services (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staff_id, service_id)
);

create index if not exists staff_services_service_idx
  on public.staff_services (service_id);

create index if not exists staff_services_org_idx
  on public.staff_services (organization_id);

alter table public.staff_services enable row level security;

drop policy if exists "staff_services_select_same_org" on public.staff_services;
create policy "staff_services_select_same_org"
  on public.staff_services for select to authenticated
  using (organization_id = public.current_user_organization_id());

drop policy if exists "staff_services_insert_same_org" on public.staff_services;
create policy "staff_services_insert_same_org"
  on public.staff_services for insert to authenticated
  with check (organization_id = public.current_user_organization_id());

drop policy if exists "staff_services_delete_same_org" on public.staff_services;
create policy "staff_services_delete_same_org"
  on public.staff_services for delete to authenticated
  using (organization_id = public.current_user_organization_id());

grant select, insert, delete on table public.staff_services to authenticated;

comment on table public.staff_services is
  'Many-to-many: which staff members perform which services. EMPTY set for an org means "everyone does everything" (sane default). Booking flow filters available staff by this when set.';

-- ---------------------------------------------------------------------------
-- 5. appointments — add client_id, allow no_show status
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists client_id uuid references public.clients (id) on delete set null;

create index if not exists appointments_client_id_idx
  on public.appointments (client_id);

alter table public.appointments
  drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in ('confirmed', 'cancelled', 'completed', 'no_show'));

comment on column public.appointments.client_id is
  'FK to canonical client record. Backfilled by upserting (organization_id, customer_phone) into public.clients. customer_name / customer_phone / customer_email remain as a denormalised cache for SMS / email templates and as a safety net during the rolling migration.';

-- ---------------------------------------------------------------------------
-- 6. Backfill clients from existing appointments
-- ---------------------------------------------------------------------------

insert into public.clients (organization_id, name, phone_e164, email, last_visit_at, total_visits)
select
  organization_id,
  -- Most recent name wins (a client may have rebooked under a slightly
  -- different spelling — pick the latest).
  (array_agg(customer_name order by start_time desc))[1] as name,
  customer_phone as phone_e164,
  -- Most recent non-null email wins.
  (array_agg(customer_email order by start_time desc) filter (where customer_email is not null))[1] as email,
  max(start_time) as last_visit_at,
  count(*) filter (where status = 'completed') as total_visits
from public.appointments
where customer_phone is not null
  and customer_phone ~ '^\+[1-9][0-9]{6,14}$'
group by organization_id, customer_phone
on conflict (organization_id, phone_e164) do nothing;

-- Link existing appointments to the freshly-created client rows.
update public.appointments a
  set client_id = c.id
  from public.clients c
 where a.client_id is null
   and a.organization_id = c.organization_id
   and a.customer_phone = c.phone_e164;

-- ---------------------------------------------------------------------------
-- 7. Trigger to maintain clients.total_visits / no_show_count / last_visit_at
-- ---------------------------------------------------------------------------

create or replace function public.tg_appointments_update_client_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text;
  v_new_status text;
begin
  v_old_status := coalesce(old.status, '');
  v_new_status := coalesce(new.status, '');

  if v_old_status = v_new_status then
    return new;
  end if;
  if new.client_id is null then
    return new;
  end if;

  -- Transitioned INTO completed.
  if v_new_status = 'completed' and v_old_status <> 'completed' then
    update public.clients
       set total_visits = total_visits + 1,
           last_visit_at = greatest(coalesce(last_visit_at, new.start_time), new.start_time),
           updated_at = now()
     where id = new.client_id;
  end if;

  -- Transitioned OUT of completed (e.g. accidental click reverted).
  if v_old_status = 'completed' and v_new_status <> 'completed' then
    update public.clients
       set total_visits = greatest(0, total_visits - 1),
           updated_at = now()
     where id = new.client_id;
  end if;

  -- Transitioned INTO no_show.
  if v_new_status = 'no_show' and v_old_status <> 'no_show' then
    update public.clients
       set no_show_count = no_show_count + 1,
           updated_at = now()
     where id = new.client_id;
  end if;

  -- Transitioned OUT of no_show.
  if v_old_status = 'no_show' and v_new_status <> 'no_show' then
    update public.clients
       set no_show_count = greatest(0, no_show_count - 1),
           updated_at = now()
     where id = new.client_id;
  end if;

  return new;
end;
$$;

drop trigger if exists tg_appointments_client_counts on public.appointments;
create trigger tg_appointments_client_counts
  after update of status on public.appointments
  for each row
  execute function public.tg_appointments_update_client_counts();

-- ---------------------------------------------------------------------------
-- 8. updated_at touch trigger (shared)
-- ---------------------------------------------------------------------------

create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tg_clients_touch on public.clients;
create trigger tg_clients_touch
  before update on public.clients
  for each row execute function public.tg_touch_updated_at();

drop trigger if exists tg_staff_working_hours_touch on public.staff_working_hours;
create trigger tg_staff_working_hours_touch
  before update on public.staff_working_hours
  for each row execute function public.tg_touch_updated_at();

drop trigger if exists tg_staff_time_off_touch on public.staff_time_off;
create trigger tg_staff_time_off_touch
  before update on public.staff_time_off
  for each row execute function public.tg_touch_updated_at();
