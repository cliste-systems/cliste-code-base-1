-- v1 Settings: where Cliste should send notifications about the business's
-- account (missed-call summaries, action-inbox alerts, billing notices, etc.).
-- Additive only; no existing columns are changed.

alter table public.organizations
  add column if not exists notification_email text,
  add column if not exists notification_phone text;

comment on column public.organizations.notification_email is
  'v1 Settings: email address for account/agent notifications.';
comment on column public.organizations.notification_phone is
  'v1 Settings: phone number for account/agent notifications (E.164 or local).';
