-- Hide services from the public menu without deleting rows (bookings / dashboard can still reference them).

alter table public.services add column if not exists is_published boolean not null default true;

comment on column public.services.is_published is
  'When false, hidden from the public booking page; staff can still book in dashboard.';
