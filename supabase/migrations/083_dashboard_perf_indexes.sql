-- Dashboard perf: composite indexes + aggregate RPCs for call metrics.

create index if not exists call_logs_org_created_at_idx
  on public.call_logs (organization_id, created_at desc);

create index if not exists action_tickets_org_status_created_at_idx
  on public.action_tickets (organization_id, status, created_at desc);

create index if not exists cara_training_items_org_updated_at_idx
  on public.cara_training_items (organization_id, updated_at desc);

create or replace function public.dashboard_call_range_metrics(
  p_organization_ids uuid[],
  p_lower timestamptz,
  p_upper timestamptz default null
)
returns table (
  total_calls bigint,
  routed_count bigint,
  avg_duration_seconds numeric,
  total_duration_seconds bigint
)
language sql
stable
set search_path = public
as $$
  select
    count(*)::bigint as total_calls,
    count(*) filter (
      where outcome in ('link_sent', 'callback_requested', 'action_created')
    )::bigint as routed_count,
    coalesce(avg(duration_seconds), 0) as avg_duration_seconds,
    coalesce(sum(duration_seconds), 0)::bigint as total_duration_seconds
  from public.call_logs
  where organization_id = any (p_organization_ids)
    and created_at >= p_lower
    and (p_upper is null or created_at < p_upper);
$$;

create or replace function public.dashboard_call_outcome_counts(
  p_organization_ids uuid[],
  p_lower timestamptz,
  p_upper timestamptz default null
)
returns table (
  outcome text,
  call_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    outcome,
    count(*)::bigint as call_count
  from public.call_logs
  where organization_id = any (p_organization_ids)
    and created_at >= p_lower
    and (p_upper is null or created_at < p_upper)
  group by outcome;
$$;

grant execute on function public.dashboard_call_range_metrics(uuid[], timestamptz, timestamptz)
  to authenticated, service_role;

grant execute on function public.dashboard_call_outcome_counts(uuid[], timestamptz, timestamptz)
  to authenticated, service_role;
