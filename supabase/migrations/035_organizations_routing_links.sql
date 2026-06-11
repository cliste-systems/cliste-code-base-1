-- v1 universal routing: where the AI agent sends callers depending on intent.
-- Additive only (no drops). Each entry: {id, label, intent, url}.
-- Examples: salon Fresha/Phorest booking link, dealership test-drive form,
-- plumber emergency callback route, clinic intake form.

alter table public.organizations
  add column if not exists routing_links jsonb not null default '[]'::jsonb;

comment on column public.organizations.routing_links is
  'v1 routing: array of {id,label,intent,url} entries the AI agent uses to send callers to the right next step (booking link, form, callback, email, etc.). Universal across business types.';
