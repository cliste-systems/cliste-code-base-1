-- Owner's plain-English paragraph for services offered (Train Cara services step).
-- Structured chips live in agent_services_departments.

alter table public.organizations
  add column if not exists agent_services_departments_raw text;

comment on column public.organizations.agent_services_departments_raw is
  'Natural-language services offered paragraph from onboarding; extracted chips in agent_services_departments.';
