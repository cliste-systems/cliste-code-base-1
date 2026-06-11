-- Resume Train Cara wizard sub-step after refresh during onboarding knowledge.
alter table public.organizations
  add column if not exists train_cara_step text;

comment on column public.organizations.train_cara_step is
  'Current Train Cara onboarding wizard step id (know, faqs, rules, call-flow, review).';
