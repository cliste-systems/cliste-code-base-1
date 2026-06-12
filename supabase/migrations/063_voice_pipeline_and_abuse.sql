-- Voice pipeline incidents (operator telemetry) and per-caller abuse signals.

create table if not exists public.voice_pipeline_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid,
  occurred_at timestamptz not null default now(),
  organization_id uuid references public.organizations (id) on delete set null,
  called_number text,
  caller_number text,
  room_name text,
  call_sid text,
  stage text not null
    check (stage in ('stt', 'llm', 'tts', 'session', 'unknown')),
  error_message text not null,
  model_label text,
  retryable boolean,
  sms_fallback_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists voice_pipeline_incidents_incident_id_uniq
  on public.voice_pipeline_incidents (incident_id)
  where incident_id is not null;

create index if not exists voice_pipeline_incidents_occurred_at_idx
  on public.voice_pipeline_incidents (occurred_at desc);

alter table public.voice_pipeline_incidents enable row level security;

drop policy if exists "voice_pipeline_incidents_no_tenant_access"
  on public.voice_pipeline_incidents;
create policy "voice_pipeline_incidents_no_tenant_access"
  on public.voice_pipeline_incidents for all to authenticated
  using (false) with check (false);

create table if not exists public.caller_abuse_signals (
  id bigserial primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  caller_number text not null,
  hit_count int not null default 1,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, caller_number)
);

create index if not exists caller_abuse_signals_org_last_seen_idx
  on public.caller_abuse_signals (organization_id, last_seen_at desc);

alter table public.caller_abuse_signals enable row level security;

create or replace function public.increment_caller_abuse_hit(
  p_org_id uuid,
  p_caller text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.caller_abuse_signals (
    organization_id,
    caller_number,
    hit_count,
    last_seen_at
  )
  values (p_org_id, p_caller, 1, now())
  on conflict (organization_id, caller_number) do update
  set
    hit_count = public.caller_abuse_signals.hit_count + 1,
    last_seen_at = now();
end;
$$;
