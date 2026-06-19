-- Owner's plain-English paragraph for business rules (Train Cara rules step).
-- Structured rules live in agent_business_rules.

alter table public.organizations
  add column if not exists agent_business_rules_raw text;

comment on column public.organizations.agent_business_rules_raw is
  'Natural-language rules paragraph from onboarding; extracted items in agent_business_rules.';
