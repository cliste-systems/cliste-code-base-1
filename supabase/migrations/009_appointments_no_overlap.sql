-- Block overlapping **confirmed** appointments per organization (single calendar).
-- If this fails to apply, resolve duplicate overlapping rows first (cancel or move one).

create extension if not exists btree_gist;

alter table public.appointments
  add constraint appointments_confirmed_no_overlap
  exclude using gist (
    organization_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (status = 'confirmed');

comment on constraint appointments_confirmed_no_overlap on public.appointments is
  'At most one confirmed booking may occupy a given instant per salon; cancelled/completed can overlap.';
