-- Filtered Supabase Realtime subscriptions (organization_id=eq.…) need FULL replica
-- identity so INSERT/UPDATE events include column values for client-side filters.
-- Without this, dashboard-live-refresh may never receive call_logs events.

alter table public.call_logs replica identity full;
alter table public.action_tickets replica identity full;
alter table public.appointments replica identity full;
alter table public.cara_training_items replica identity full;
