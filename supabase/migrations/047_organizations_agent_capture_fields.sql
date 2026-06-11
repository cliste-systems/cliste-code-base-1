-- Structured caller capture fields for Cara (onboarding collect step).

alter table public.organizations
  add column if not exists agent_capture_fields jsonb not null default '[]'::jsonb;

comment on column public.organizations.agent_capture_fields is
  'Ordered list of {id, label, custom?} fields Cara should collect from callers.';
