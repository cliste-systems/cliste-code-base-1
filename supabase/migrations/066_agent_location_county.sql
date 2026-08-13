alter table public.organizations
  add column if not exists agent_location_county text;

comment on column public.organizations.agent_location_county is
  'County for voice agent location (e.g. Dublin, Donegal). Street and town live in agent_location_address and agent_base_town.';
