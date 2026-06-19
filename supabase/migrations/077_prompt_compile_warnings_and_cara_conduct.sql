-- Prompt compile warnings (trim/budget metadata) and structured Cara conduct toggles.
alter table public.organizations
  add column if not exists prompt_compile_warnings jsonb,
  add column if not exists agent_cara_conduct jsonb;

comment on column public.organizations.prompt_compile_warnings is
  'Last compile trim/budget metadata when custom_prompt was regenerated.';

comment on column public.organizations.agent_cara_conduct is
  'Structured Cara style toggles (first name, tone, link delivery, answer length).';

-- Default conduct for existing orgs.
update public.organizations
set agent_cara_conduct = jsonb_build_object(
  'useFirstName', true,
  'answerLength', 'normal',
  'linkDelivery', 'text',
  'tone', 'professional'
)
where agent_cara_conduct is null;
