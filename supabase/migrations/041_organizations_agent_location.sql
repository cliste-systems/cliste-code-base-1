-- Cara Setup: physical location for directions / "where are you?" answers.

alter table public.organizations
  add column if not exists agent_location_address text,
  add column if not exists agent_location_eircode text;

comment on column public.organizations.agent_location_address is
  'v1 Agent Setup: street / town address Cara can give callers.';
comment on column public.organizations.agent_location_eircode is
  'v1 Agent Setup: Irish Eircode for the business location (e.g. D06 X2P6).';
