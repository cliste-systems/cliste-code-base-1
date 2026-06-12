-- Town the business is based in (service-area anchor for coverage / radius).

alter table public.organizations
  add column if not exists agent_base_town text;

comment on column public.organizations.agent_base_town is
  'Town the business is based in — used for service-area coverage and distance answers.';
