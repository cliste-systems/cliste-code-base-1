-- Cara default voice: Max (Creative v3) on ElevenLabs.
alter table public.organizations
  alter column agent_voice_id set default 'C92s6vssSLlabgIln1iY';

comment on column public.organizations.agent_voice_id is
  'ElevenLabs voice id for the phone agent TTS (e.g. C92s6vssSLlabgIln1iY — Max Creative v3).';

update public.organizations
set agent_voice_id = 'C92s6vssSLlabgIln1iY'
where agent_voice_id in ('UwtFVYnvYG6hxAbc4I6T', 'irish_warm');
