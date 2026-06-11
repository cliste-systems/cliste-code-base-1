-- Caller-facing voice preset for the AI phone agent (onboarding + Cara Setup).

alter table public.organizations
  add column if not exists agent_voice_id text not null default 'irish_warm';

comment on column public.organizations.agent_voice_id is
  'Voice preset id for the phone agent TTS (e.g. irish_warm). Read by the voice worker.';
