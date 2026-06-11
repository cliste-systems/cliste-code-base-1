alter table public.organizations
  add column if not exists agent_service_area_exclusions text;

comment on column public.organizations.agent_service_area_exclusions is
  'Towns or areas excluded within covered counties — one per line in storage.';
