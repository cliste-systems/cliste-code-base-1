-- Outbound SMS metering for Stripe overage billing.

create table if not exists public.sms_usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  segments integer not null default 1 check (segments >= 1),
  purpose text not null default 'outbound',
  sent_at timestamptz not null default now(),
  synced_to_stripe_at timestamptz,
  stripe_usage_record_id text
);

create index if not exists sms_usage_records_org_sent_idx
  on public.sms_usage_records (organization_id, sent_at desc);

create index if not exists sms_usage_records_unsynced_idx
  on public.sms_usage_records (synced_to_stripe_at)
  where synced_to_stripe_at is null;

comment on table public.sms_usage_records is
  'Per-SMS segment metering for Stripe cliste_sms meter overage.';

alter table public.sms_usage_records enable row level security;

create policy "sms_usage_records_select_same_org"
  on public.sms_usage_records
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

grant select on table public.sms_usage_records to authenticated;

-- Voice compliance telemetry (disclosure misses, etc.).

create table if not exists public.compliance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists compliance_events_org_created_idx
  on public.compliance_events (organization_id, created_at desc);

create index if not exists compliance_events_type_created_idx
  on public.compliance_events (event_type, created_at desc);

comment on table public.compliance_events is
  'Ops/compliance signals (e.g. voice disclosure_not_confirmed). Service role writes; admin reads.';

alter table public.compliance_events enable row level security;

-- No tenant policies — service role only.
