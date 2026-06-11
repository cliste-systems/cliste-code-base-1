-- Natural-language fields from Train Cara onboarding (step 2 exclusions + step 4 capture).

alter table public.organizations
  add column if not exists agent_services_not_offered text,
  add column if not exists agent_details_to_collect text;

comment on column public.organizations.agent_services_not_offered is
  'Services, jobs, or request types Cara must not agree to on calls.';

comment on column public.organizations.agent_details_to_collect is
  'Natural-language list of caller details Cara should collect on calls.';
