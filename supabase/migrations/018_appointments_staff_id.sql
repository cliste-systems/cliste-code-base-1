-- Assigned professional per appointment + per-staff overlap (resource calendar).

create extension if not exists btree_gist;

alter table public.appointments
  drop constraint if exists appointments_confirmed_no_overlap;

alter table public.appointments
  drop constraint if exists appointments_confirmed_no_overlap_per_staff;

alter table public.appointments
  drop column if exists staff_bucket cascade;

alter table public.appointments
  add column if not exists staff_id uuid references public.profiles (id) on delete set null;

create index if not exists appointments_staff_id_idx on public.appointments (staff_id);

alter table public.appointments
  add column staff_bucket uuid
  generated always as (
    coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored;

alter table public.appointments
  add constraint appointments_confirmed_no_overlap_per_staff
  exclude using gist (
    organization_id with =,
    staff_bucket with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (status = 'confirmed');

comment on column public.appointments.staff_id is
  'Assigned professional (`profiles.id`). Null shares one unassigned pool for overlap checks.';

comment on column public.appointments.staff_bucket is
  'Generated key for exclusion: coalesce(staff_id, all-zero uuid).';
