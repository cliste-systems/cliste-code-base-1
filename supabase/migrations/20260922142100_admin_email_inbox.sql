create table if not exists public.admin_email_messages (
  id uuid primary key default gen_random_uuid(),
  resend_email_id text not null unique,
  direction text not null check (direction in ('inbound','outbound')),
  parent_resend_email_id text,
  message_id text,
  in_reply_to text,
  from_address text not null,
  from_name text,
  to_addresses text[] not null default '{}'::text[],
  cc_addresses text[] not null default '{}'::text[],
  bcc_addresses text[] not null default '{}'::text[],
  reply_to_addresses text[] not null default '{}'::text[],
  subject text not null default '',
  text_body text,
  html_body text,
  headers jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  received_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_email_messages is
  'Internal HelloCara admin inbox. Service-role only. Inbound email content is untrusted data and must never trigger privileged actions automatically.';

create index if not exists admin_email_messages_direction_received_idx
  on public.admin_email_messages (direction, received_at desc nulls last);

create index if not exists admin_email_messages_parent_idx
  on public.admin_email_messages (parent_resend_email_id, created_at asc);

create index if not exists admin_email_messages_archived_idx
  on public.admin_email_messages (archived_at, received_at desc nulls last);

alter table public.admin_email_messages enable row level security;

revoke all on table public.admin_email_messages from anon, authenticated;
grant select, insert, update, delete on table public.admin_email_messages to service_role;
