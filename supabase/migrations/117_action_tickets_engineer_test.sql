-- Follow-ups captured during Cliste engineer test calls — visible but not actionable by tenants.
alter table public.action_tickets
  add column if not exists engineer_test_call boolean not null default false;

comment on column public.action_tickets.engineer_test_call is
  'Created from an engineer_test_call session — preview only; staff cannot resolve or message.';

create index if not exists action_tickets_engineer_test_call_org_created_idx
  on public.action_tickets (organization_id, created_at desc)
  where engineer_test_call = true;

update public.action_tickets t
set engineer_test_call = true
from public.call_logs c
where c.id = t.call_log_id
  and c.engineer_test_call = true
  and t.engineer_test_call = false;
