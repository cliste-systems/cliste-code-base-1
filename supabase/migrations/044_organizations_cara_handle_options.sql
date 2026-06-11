alter table public.organizations
  add column if not exists cara_handle_options jsonb;

comment on column public.organizations.cara_handle_options is
  'Train Cara onboarding: ids of what Cara should handle (e.g. send_link, take_message).';
