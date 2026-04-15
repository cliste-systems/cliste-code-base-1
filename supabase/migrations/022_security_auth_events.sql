-- Central security event log for authentication and admin access attempts.

create table if not exists public.security_auth_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  event_type text not null,
  outcome text not null,
  source text not null default 'app',
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email text,
  target_user_id uuid references auth.users (id) on delete set null,
  target_email text,
  login_email text,
  ip_hash text,
  ip_masked text,
  ip_country text,
  user_agent text,
  attempt_count int,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists security_auth_events_created_idx
  on public.security_auth_events (created_at desc);

create index if not exists security_auth_events_type_created_idx
  on public.security_auth_events (event_type, created_at desc);

create index if not exists security_auth_events_outcome_created_idx
  on public.security_auth_events (outcome, created_at desc);

create index if not exists security_auth_events_ip_hash_created_idx
  on public.security_auth_events (ip_hash, created_at desc);

create index if not exists security_auth_events_login_email_created_idx
  on public.security_auth_events (login_email, created_at desc);

comment on table public.security_auth_events is
  'Security-sensitive authentication/admin events. Service role writes; admin UI reads via service role.';

alter table public.security_auth_events enable row level security;
