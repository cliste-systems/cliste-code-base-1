-- Salon service catalog trial: quote toggle on org, import metadata on services.
-- price = 0 and duration_minutes = 0 mean "unset" in app UI and voice prompts.

alter table public.organizations
  add column if not exists quote_prices_on_calls boolean not null default false;

comment on column public.organizations.quote_prices_on_calls is
  'When true, Cara may quote stored service prices on calls (salon trial).';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_catalog_source') then
    create type public.service_catalog_source as enum (
      'manual',
      'booking_import',
      'website_import'
    );
  end if;
end $$;

alter table public.services
  add column if not exists source public.service_catalog_source not null default 'manual';

alter table public.services
  add column if not exists imported_at timestamptz;

comment on column public.services.source is
  'How this service row was created (manual entry or import).';

comment on column public.services.imported_at is
  'When this row was last imported from an external menu URL.';

comment on column public.services.price is
  'Service price in EUR. 0 means unset — not quoted on calls.';

comment on column public.services.duration_minutes is
  'Typical duration in minutes. 0 means unset.';
