-- Platform / infra break signals (recording upload failed, webhook down, etc.).

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  severity text not null check (severity in ('critical', 'warning', 'info')),
  category text not null,
  event_type text not null,
  source text not null default 'voice_worker',
  organization_id uuid references public.organizations (id) on delete set null,
  call_log_id uuid references public.call_logs (id) on delete set null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists platform_events_created_idx
  on public.platform_events (created_at desc);

create index if not exists platform_events_severity_created_idx
  on public.platform_events (severity, created_at desc);

create index if not exists platform_events_category_created_idx
  on public.platform_events (category, created_at desc);

create index if not exists platform_events_call_log_idx
  on public.platform_events (call_log_id)
  where call_log_id is not null;

comment on table public.platform_events is
  'Ops signals when platform code or infra breaks (recording upload, webhooks, lookups). Service role writes; admin reads.';

alter table public.platform_events enable row level security;
