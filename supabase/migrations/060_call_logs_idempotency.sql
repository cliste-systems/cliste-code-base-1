-- Idempotency for voice worker call-complete webhook retries.

alter table public.call_logs
  add column if not exists call_sid text,
  add column if not exists room_name text;

create unique index if not exists call_logs_call_sid_unique
  on public.call_logs (call_sid)
  where call_sid is not null;

comment on column public.call_logs.call_sid is
  'Stable call identifier from Twilio/LiveKit — dedupes call-complete webhook retries.';
