-- Dashboard sidebar badge counts (Action Inbox, Call History, Calendar,
-- Bookings) rely on Supabase Realtime to refresh within ~1 second of a new
-- call/booking/ticket. The web client subscribes to INSERT/UPDATE events on
-- `call_logs`, `action_tickets`, and `appointments` filtered by
-- organization_id; see `src/components/dashboard-live-refresh.tsx`.
--
-- The `supabase_realtime` publication exists by default but ships empty, so
-- none of those events were reaching the client before this migration and
-- the dashboard fell back to a 45s polling loop. Adding the tables below
-- turns Realtime on for all of them.
--
-- We use conditional `ALTER PUBLICATION ... ADD TABLE` inside a DO block so
-- the migration is idempotent (a table already in the publication raises
-- duplicate_object otherwise, which would break re-runs against existing
-- environments that enabled Realtime manually via the Supabase UI).

do $$
declare
  t text;
begin
  foreach t in array array[
    'public.call_logs',
    'public.action_tickets',
    'public.appointments'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname || '.' || tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %s', t);
    end if;
  end loop;
end
$$;
