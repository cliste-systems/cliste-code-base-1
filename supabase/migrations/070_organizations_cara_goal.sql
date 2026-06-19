-- What the owner wants Cara to do: FAQ-only vs full outbound follow-up.
alter table public.organizations
  add column if not exists cara_goal text not null default 'full_agent';

alter table public.organizations
  drop constraint if exists organizations_cara_goal_check;

alter table public.organizations
  add constraint organizations_cara_goal_check
  check (cara_goal in ('faq_only', 'full_agent'));

comment on column public.organizations.cara_goal is
  'Owner intent: faq_only = answer questions and take messages; full_agent = also send links, email, WhatsApp.';
