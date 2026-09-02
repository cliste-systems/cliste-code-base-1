-- Verify dashboard hot-path indexes are used (run after 083_dashboard_perf_indexes.sql).
-- Replace :org_id with a real organization UUID from dev.

explain (analyze, buffers)
select count(*)::bigint,
       count(*) filter (where outcome in ('link_sent', 'callback_requested', 'action_created'))::bigint,
       coalesce(avg(duration_seconds), 0),
       coalesce(sum(duration_seconds), 0)::bigint
from public.call_logs
where organization_id = :'org_id'::uuid
  and created_at >= now() - interval '30 days';

explain (analyze, buffers)
select outcome, count(*)::bigint
from public.call_logs
where organization_id = :'org_id'::uuid
  and created_at >= now() - interval '30 days'
group by outcome;

explain (analyze, buffers)
select id, caller_number, created_at
from public.call_logs
where organization_id = :'org_id'::uuid
  and created_at >= now() - interval '30 days'
order by created_at desc
limit 2000;
