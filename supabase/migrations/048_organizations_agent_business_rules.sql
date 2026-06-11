-- Hard business rules Cara must follow on calls (onboarding rules step).

alter table public.organizations
  add column if not exists agent_business_rules jsonb not null default '[]'::jsonb;

comment on column public.organizations.agent_business_rules is
  'Ordered list of short policy strings Cara must never break on a call.';
