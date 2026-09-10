-- Admin call testing: test-call tagging, split-test profiles, and rich QA reports.

alter table public.call_logs
  add column if not exists is_test_call boolean not null default false,
  add column if not exists called_number text;

comment on column public.call_logs.is_test_call is
  'True for internal QA rings (e.g. +353749389378). Hidden from tenant call history.';
comment on column public.call_logs.called_number is
  'E.164 DID the caller dialled (SIP trunk / routing).';

create index if not exists call_logs_is_test_call_created_idx
  on public.call_logs (is_test_call, created_at desc)
  where is_test_call = true;

create table if not exists public.call_test_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  voice_id text,
  llm_model text,
  stt_model text,
  tts_model text,
  llm_provider text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.call_test_profiles is
  'Split-test voice pipeline configs applied on the internal test line only.';

create unique index if not exists call_test_profiles_one_active_idx
  on public.call_test_profiles (is_active)
  where is_active = true;

create table if not exists public.call_test_reports (
  id uuid primary key default gen_random_uuid(),
  call_log_id uuid not null references public.call_logs (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  test_profile_id uuid references public.call_test_profiles (id) on delete set null,
  variant_label text,
  called_number text,
  caller_number text,
  call_sid text,
  room_name text,
  health_status text not null
    check (health_status in ('pass', 'degraded', 'fail')),
  health_reason text,
  latency jsonb not null default '{}'::jsonb,
  pipeline_snapshot jsonb not null default '{}'::jsonb,
  diagnostics jsonb not null default '{}'::jsonb,
  error_count int not null default 0,
  greeting_played boolean not null default false,
  disclosure_confirmed boolean not null default false,
  duration_seconds int not null default 0,
  created_at timestamptz not null default now(),
  unique (call_log_id)
);

create index if not exists call_test_reports_created_at_idx
  on public.call_test_reports (created_at desc);

create index if not exists call_test_reports_variant_label_idx
  on public.call_test_reports (variant_label, created_at desc)
  where variant_label is not null;

comment on table public.call_test_reports is
  'Rich per-call QA diagnostics for admin /admin/call-testing. Service role only.';

alter table public.call_test_profiles enable row level security;
alter table public.call_test_reports enable row level security;

drop policy if exists "call_test_profiles_no_tenant_access" on public.call_test_profiles;
create policy "call_test_profiles_no_tenant_access"
  on public.call_test_profiles for all to authenticated
  using (false) with check (false);

drop policy if exists "call_test_reports_no_tenant_access" on public.call_test_reports;
create policy "call_test_reports_no_tenant_access"
  on public.call_test_reports for all to authenticated
  using (false) with check (false);

-- Default split-test profiles (activate one in /admin/call-testing before ringing).
insert into public.call_test_profiles (
  name,
  description,
  voice_id,
  llm_model,
  stt_model,
  tts_model,
  llm_provider,
  is_active
)
select
  'Production default',
  'Current prod stack: Eleven turbo v2.5, gpt-4o-mini, Deepgram flux',
  'C92s6vssSLlabgIln1iY',
  'gpt-4o-mini',
  'deepgram/flux-general',
  'eleven_turbo_v2_5',
  'gateway',
  true
where not exists (select 1 from public.call_test_profiles);

insert into public.call_test_profiles (
  name,
  description,
  voice_id,
  llm_model,
  stt_model,
  tts_model,
  llm_provider,
  is_active
)
select
  'Eleven flash alt voice',
  'Eleven flash v2.5 with alternate voice for A/B comparison',
  'pNInz6obpgDQGcFmaJgB',
  'gpt-4o-mini',
  'deepgram/flux-general',
  'eleven_flash_v2_5',
  'gateway',
  false
where not exists (
  select 1 from public.call_test_profiles where name = 'Eleven flash alt voice'
);
