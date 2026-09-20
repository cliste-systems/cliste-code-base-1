-- Staff admin browser demo calls: visible to tenants as a test badge only.
alter table public.call_logs
  add column if not exists engineer_test_call boolean not null default false;

comment on column public.call_logs.engineer_test_call is
  'Cliste engineer admin simulator call — tenant sees minimal test entry only; not billed; no recording/transcript access.';

create index if not exists call_logs_engineer_test_call_org_created_idx
  on public.call_logs (organization_id, created_at desc)
  where engineer_test_call = true;

-- Backfill existing admin simulator sessions.
update public.call_logs
set engineer_test_call = true
where engineer_test_call = false
  and (
    caller_number = '+353870000001'
    or room_name like 'admin-demo-%'
  );

-- Zero billable minutes for backfilled engineer tests (usage rows may exist from before this flag).
update public.usage_records ur
set
  minutes_billable = 0,
  sync_skip_reason = coalesce(nullif(trim(ur.sync_skip_reason), ''), 'engineer_test_call')
from public.call_logs cl
where cl.room_name is not null
  and cl.room_name = ur.room_name
  and cl.engineer_test_call = true
  and coalesce(ur.minutes_billable, 0) > 0;
