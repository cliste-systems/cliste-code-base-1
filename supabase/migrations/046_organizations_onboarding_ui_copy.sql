-- AI-generated FAQ suggestions and hints for onboarding (cached per org).

alter table public.organizations
  add column if not exists onboarding_ui_copy jsonb;

comment on column public.organizations.onboarding_ui_copy is
  'Cached onboarding FAQ UI copy (suggestions, hints, placeholders) generated from business profile and know-step data.';
