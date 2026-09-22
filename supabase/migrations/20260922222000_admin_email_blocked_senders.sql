create table if not exists public.admin_email_blocked_senders (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint admin_email_blocked_senders_email_lowercase
    check (email = lower(email)),
  constraint admin_email_blocked_senders_email_not_blank
    check (length(trim(email)) > 0)
);

comment on table public.admin_email_blocked_senders is
  'Exact sender addresses blocked in the internal HelloCara admin inbox. Service-role only.';

alter table public.admin_email_blocked_senders enable row level security;

revoke all on table public.admin_email_blocked_senders from anon, authenticated;
grant select, insert, delete on table public.admin_email_blocked_senders to service_role;
