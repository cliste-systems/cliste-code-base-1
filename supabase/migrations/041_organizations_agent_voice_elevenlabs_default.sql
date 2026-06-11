-- Store ElevenLabs voice id for the default onboarding voice preview.

alter table public.organizations
  alter column agent_voice_id set default 'UwtFVYnvYG6hxAbc4I6T';

comment on column public.organizations.agent_voice_id is
  'ElevenLabs voice id for the phone agent TTS (e.g. UwtFVYnvYG6hxAbc4I6T).';
