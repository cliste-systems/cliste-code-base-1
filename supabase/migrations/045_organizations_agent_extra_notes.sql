alter table public.organizations
  add column if not exists agent_extra_notes text;

comment on column public.organizations.agent_extra_notes is
  'Train Cara onboarding: free-text extra facts the owner wants Cara to know on calls.';
