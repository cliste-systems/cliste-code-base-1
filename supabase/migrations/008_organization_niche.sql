-- Product vertical for dashboard header (Cliste + Salon vs Cliste + Barber).
alter table public.organizations
  add column niche text;

update public.organizations
set niche = 'hair_salon'
where niche is null;

alter table public.organizations
  alter column niche set default 'hair_salon',
  alter column niche set not null;

alter table public.organizations
  add constraint organizations_niche_check check (niche in ('hair_salon', 'barber'));

comment on column public.organizations.niche is
  'Admin-selected vertical: hair_salon (shows as Salon) or barber (shows as Barber) beside Cliste in the dashboard.';
