create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  service_id uuid not null references public.services (id) on delete restrict,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'confirmed'
    constraint appointments_status_check check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

create index appointments_organization_id_idx on public.appointments (organization_id);
create index appointments_start_time_idx on public.appointments (start_time);

alter table public.appointments enable row level security;

create policy "appointments_select_same_org"
  on public.appointments
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

create policy "appointments_insert_same_org"
  on public.appointments
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

create policy "appointments_update_same_org"
  on public.appointments
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy "appointments_delete_same_org"
  on public.appointments
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

grant select, insert, update, delete on table public.appointments to authenticated;
