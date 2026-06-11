-- v1 Agent Setup: universal, business-type-agnostic configuration fields the AI
-- agent uses. Additive only; no existing columns are changed.
--
--   agent_business_type   free-text vertical (e.g. "Dental clinic", "Plumber").
--                         Distinct from `niche`, which is the salon-only
--                         (hair_salon/barber) header vertical.
--   agent_faqs            array of {question, answer} the agent can answer from.
--   agent_opening_hours   plain text or simple structured hours.
--   agent_service_area    free-text service area / coverage notes.

alter table public.organizations
  add column if not exists agent_business_type text,
  add column if not exists agent_faqs jsonb not null default '[]'::jsonb,
  add column if not exists agent_opening_hours text,
  add column if not exists agent_service_area text;

comment on column public.organizations.agent_business_type is
  'v1 Agent Setup: free-text business type (universal across verticals).';
comment on column public.organizations.agent_faqs is
  'v1 Agent Setup: array of {question, answer} entries the AI agent can answer from.';
comment on column public.organizations.agent_opening_hours is
  'v1 Agent Setup: opening hours as plain text or simple structured text.';
comment on column public.organizations.agent_service_area is
  'v1 Agent Setup: free-text service area / coverage notes.';
