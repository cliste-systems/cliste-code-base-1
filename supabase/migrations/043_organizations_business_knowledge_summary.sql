-- Onboarding knowledge: raw owner description + Cara's structured notes.

alter table public.organizations
  add column if not exists raw_business_description text,
  add column if not exists business_knowledge_summary text;

comment on column public.organizations.raw_business_description is
  'Plain-language business description captured during onboarding knowledge training.';

comment on column public.organizations.business_knowledge_summary is
  'Editable Cara notes derived from the business description — spoken context on calls.';
