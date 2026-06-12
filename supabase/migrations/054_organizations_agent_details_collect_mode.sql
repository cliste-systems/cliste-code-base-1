-- How Cara collects optional caller details (conversational vs fixed order).

alter table public.organizations
  add column if not exists agent_details_collect_mode text not null default 'conversational';

alter table public.organizations
  drop constraint if exists organizations_agent_details_collect_mode_check;

alter table public.organizations
  add constraint organizations_agent_details_collect_mode_check
  check (agent_details_collect_mode in ('conversational', 'fixed'));

comment on column public.organizations.agent_details_collect_mode is
  'How Cara collects optional caller details: conversational (default) or fixed (strict order).';
