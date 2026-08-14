-- Daily call counts with optional voice-cost estimates.
-- cost_estimate lives on call_logs when the voice worker migration is applied;
-- this view is a no-op until that column exists.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'call_logs'
      and column_name = 'cost_estimate'
  ) then
    execute $view$
      create or replace view public.call_cost_daily_with_estimate as
      select
        organization_id,
        timezone('Europe/Dublin', created_at)::date as day,
        count(*)::integer as call_count,
        count(cost_estimate)::integer as calls_with_estimate,
        coalesce(
          sum(
            nullif((cost_estimate::jsonb) ->> 'totalUsd', '')::numeric
          ),
          0
        ) as estimated_usd
      from public.call_logs
      group by organization_id, timezone('Europe/Dublin', created_at)::date;

      comment on view public.call_cost_daily_with_estimate is
        'Per-org daily call counts and summed cost_estimate.totalUsd (Europe/Dublin day).';

      grant select on public.call_cost_daily_with_estimate to authenticated;
    $view$;
  end if;
end
$$;
