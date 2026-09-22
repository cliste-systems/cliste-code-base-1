alter table public.admin_email_messages
  add column if not exists resend_sent_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_delayed_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists suppressed_at timestamptz,
  add column if not exists complained_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists clicked_at timestamptz,
  add column if not exists last_delivery_event text,
  add column if not exists last_delivery_event_at timestamptz,
  add column if not exists delivery_detail jsonb not null default '{}'::jsonb;

create table if not exists public.admin_email_events (
  id text primary key,
  resend_email_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.admin_email_events is
  'Verified Resend lifecycle events for internal HelloCara sent-email delivery and engagement status. Service-role only.';

create index if not exists admin_email_events_resend_email_idx
  on public.admin_email_events (resend_email_id, occurred_at asc);

alter table public.admin_email_events enable row level security;
revoke all on table public.admin_email_events from anon, authenticated;
grant select, insert, delete on table public.admin_email_events to service_role;

create table if not exists public.admin_email_webhook_config (
  webhook_id text primary key,
  signing_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_email_webhook_config is
  'Resend webhook signing configuration for the internal admin email lifecycle endpoint. Service-role only.';

alter table public.admin_email_webhook_config enable row level security;
revoke all on table public.admin_email_webhook_config from anon, authenticated;
grant select, insert, update, delete on table public.admin_email_webhook_config to service_role;
