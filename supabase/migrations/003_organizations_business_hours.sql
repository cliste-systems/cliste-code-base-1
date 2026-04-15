alter table public.organizations
  add column if not exists business_hours jsonb not null default '{}'::jsonb;

comment on column public.organizations.business_hours is
  'Weekly schedule: { "monday": { "open": true, "start": "09:00", "end": "17:30" }, ... }';
