-- Extracted net-new services and policy notes from owner "own words" when a catalog exists.
alter table public.organizations
  add column if not exists agent_service_catalog_supplement jsonb;

comment on column public.organizations.agent_service_catalog_supplement is
  'Salon catalog supplement from agent_services_departments_raw: { supplementalServices: string[], generalNotes: string }.';
