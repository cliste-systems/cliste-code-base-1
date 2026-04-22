-- Track "pipeline-level" voice worker failures — STT / LLM / TTS WebSocket
-- connects that died with `recoverable: false` and forced the AgentSession
-- to close mid-call. These are distinct from call_logs (customer-visible
-- call records) because they are operational telemetry about our own
-- infrastructure: a transient outage in LiveKit's inference gateway, a
-- Deepgram disconnect, an OpenAI 5xx. The worker posts one row per call
-- that hit such a failure via POST /api/voice/pipeline-incident.
--
-- Surfaced on the platform-admin overview (/admin) under a "Voice pipeline
-- health" section so we can spot gateway blips before customers phone in
-- to complain. Intentionally NOT exposed to the per-tenant dashboard —
-- the caller's booking fallback already lands in their SMS flow.
--
-- No RLS policies for authenticated: this table is operator-only. Only
-- service-role (which bypasses RLS) reads and writes it; the admin
-- dashboard uses `createAdminClient()` for both the insert webhook and
-- the dashboard query.

create table if not exists public.voice_pipeline_incidents (
  id uuid primary key default gen_random_uuid(),
  -- Stable id chosen by the worker BEFORE the HTTP call so retries from
  -- the worker do not double-insert the same incident. Enforced by the
  -- unique index below. Nullable to stay compatible with future writers
  -- that forget to supply it — we fall back to id-only dedupe at that
  -- point.
  incident_id uuid,
  occurred_at timestamptz not null default now(),
  organization_id uuid references public.organizations (id) on delete set null,
  -- The SIP DID the caller dialled, E.164. Lets us render the tenant
  -- label on /admin even when organization_id resolution failed
  -- upstream (e.g. because the gateway died before the agent could
  -- resolve the salon row).
  called_number text,
  -- Caller E.164 (may be null for withheld-line SIP calls). Stored as
  -- received; redaction happens in the UI when rendering.
  caller_number text,
  room_name text,
  call_sid text,
  -- Which stage of the pipeline failed. 'session' is a catch-all for
  -- session-level errors that are not attributable to a single model.
  stage text not null
    check (stage in ('stt', 'llm', 'tts', 'session', 'unknown')),
  -- Short human-readable error message — already PII-stripped on the
  -- worker side. Capped at ~500 chars by the inserting endpoint; the
  -- DB itself does not enforce a length because the inserting worker
  -- already truncates.
  error_message text not null,
  -- Model slug at the point of failure, e.g. `deepgram/flux-general` or
  -- `deepgram-direct:nova-3`.
  model_label text,
  -- Whether the underlying error was advertised as retryable by the
  -- SDK. Null if the worker couldn't determine it.
  retryable boolean,
  -- Whether the worker's SMS soft-landing (fallback booking link) fired
  -- successfully. Drives a tiny "caller got SMS" badge in the admin UI.
  sms_fallback_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists voice_pipeline_incidents_incident_id_uniq
  on public.voice_pipeline_incidents (incident_id)
  where incident_id is not null;

create index if not exists voice_pipeline_incidents_occurred_at_idx
  on public.voice_pipeline_incidents (occurred_at desc);

create index if not exists voice_pipeline_incidents_org_occurred_idx
  on public.voice_pipeline_incidents (organization_id, occurred_at desc);

-- Operator-only table: lock it down and don't grant to `authenticated`.
-- service_role bypasses RLS; the admin dashboard uses that via
-- createAdminClient().
alter table public.voice_pipeline_incidents enable row level security;

-- Explicit "no access" policy for authenticated so a misconfigured
-- server-side call that slips through on the anon/authenticated key
-- can't read ops data.
drop policy if exists "voice_pipeline_incidents_no_tenant_access"
  on public.voice_pipeline_incidents;
create policy "voice_pipeline_incidents_no_tenant_access"
  on public.voice_pipeline_incidents for all to authenticated
  using (false) with check (false);

comment on table public.voice_pipeline_incidents is
  'Operator-only: voice worker STT/LLM/TTS unrecoverable failures, one row per affected call. Surfaced on /admin under "Voice pipeline health". Not for per-tenant dashboards.';
