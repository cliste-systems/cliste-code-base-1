-- Caller identity for Contacts/Calls; caller-facing assistant name for Cara Setup.

alter table public.organizations
  add column if not exists assistant_display_name text default 'Cara';

comment on column public.organizations.assistant_display_name is
  'Name callers hear on the phone. Dashboard product name remains Cara.';

alter table public.call_logs
  add column if not exists caller_name text;

comment on column public.call_logs.caller_name is
  'Optional caller name from the voice worker when known.';

alter table public.action_tickets
  add column if not exists caller_name text;

comment on column public.action_tickets.caller_name is
  'Optional caller name when the ticket is created.';
