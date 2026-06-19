-- Owner's plain-English paragraph for service exclusions (Train Cara exclusions step).
-- Structured chips live in agent_services_not_offered.

alter table public.organizations
  add column if not exists agent_services_not_offered_raw text;

comment on column public.organizations.agent_services_not_offered_raw is
  'Natural-language exclusions paragraph from onboarding; extracted chips in agent_services_not_offered.';
