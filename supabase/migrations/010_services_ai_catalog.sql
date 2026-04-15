-- Richer service copy for storefront, voice AI, and admin catalog (same rows as bookings).

alter table public.services add column if not exists description text;

alter table public.services add column if not exists ai_voice_notes text;

comment on column public.services.description is
  'Short line for customers and AI: what is included, prerequisites, etc.';

comment on column public.services.ai_voice_notes is
  'Optional facts only for the voice agent (not shown on public menu by default).';
