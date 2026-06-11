-- Insert Business knowledge as onboarding step 3 (after voice, before plan).
-- Bump existing progress so orgs already past voice land on the right step.

update public.organizations
set onboarding_step = onboarding_step + 1
where onboarding_step >= 3;

comment on column public.organizations.onboarding_step is
  '1 profile, 2 voice, 3 knowledge, 4 plan, 5 phone, 6 routing, 7 agent, 8 test, 9 done';

-- Optional label for uploaded knowledge documents.
alter table public.business_files
  add column if not exists document_kind text;

alter table public.organizations
  add column if not exists agent_services_departments text;

comment on column public.business_files.document_kind is
  'User-facing kind: price_list, menu, brochure, stock_sheet, service_sheet, faq_document, other';

comment on column public.organizations.agent_services_departments is
  'Services, departments, or business areas Cara should know about.';
