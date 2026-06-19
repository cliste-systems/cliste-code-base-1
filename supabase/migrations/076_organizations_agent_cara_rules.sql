-- Cara-specific call conduct rules (tone, phrasing, extra behaviour on calls).

alter table public.organizations
  add column if not exists agent_cara_rules jsonb not null default '[]'::jsonb;

comment on column public.organizations.agent_cara_rules is
  'Ordered list of short strings describing how Cara should handle calls beyond business policies.';
