alter table public.organizations
  add column if not exists train_cara_skipped_at timestamptz;

comment on column public.organizations.train_cara_skipped_at is
  'When the owner used Finish later on Train Cara after saving services and hours.';
