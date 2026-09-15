-- Post-call processing visibility: track close-pipeline health on call_logs
-- and link action_tickets back to the originating call.

alter table public.call_logs
  add column if not exists post_call_status text not null default 'pending'
    check (post_call_status in ('pending', 'complete', 'partial', 'failed')),
  add column if not exists post_call_errors jsonb not null default '[]'::jsonb,
  add column if not exists post_call_expected_ticket boolean not null default false;

comment on column public.call_logs.post_call_status is
  'Close-pipeline health: pending until worker finishes; complete when log+tickets OK; partial/failed when something broke.';

comment on column public.call_logs.post_call_errors is
  'Array of { stage, message, at } objects from the voice worker close handler.';

comment on column public.call_logs.post_call_expected_ticket is
  'True when retail postprocess extracted an order/callback that should produce an action ticket.';

create index if not exists call_logs_post_call_status_created_idx
  on public.call_logs (post_call_status, created_at desc)
  where post_call_status in ('partial', 'failed');

create index if not exists call_logs_expected_ticket_missing_idx
  on public.call_logs (organization_id, created_at desc)
  where post_call_expected_ticket = true and post_call_status in ('partial', 'failed', 'pending');

alter table public.action_tickets
  add column if not exists call_log_id uuid references public.call_logs (id) on delete set null,
  add column if not exists delivery_status text not null default 'confirmed'
    check (delivery_status in ('confirmed', 'pending_review', 'failed'));

comment on column public.action_tickets.call_log_id is
  'Originating call_logs row when the ticket was created from post-call processing.';

comment on column public.action_tickets.delivery_status is
  'confirmed = full order details; pending_review = placeholder while Cliste fixes processing; failed = could not deliver.';

create index if not exists action_tickets_call_log_id_idx
  on public.action_tickets (call_log_id)
  where call_log_id is not null;

create index if not exists action_tickets_delivery_status_idx
  on public.action_tickets (organization_id, delivery_status, created_at desc)
  where delivery_status <> 'confirmed';

-- Existing rows: treat as complete unless clearly broken (no summary and action_created).
update public.call_logs
set post_call_status = 'complete'
where post_call_status = 'pending'
  and created_at < now() - interval '1 hour';

update public.call_logs
set post_call_status = 'partial'
where post_call_status = 'pending'
  and outcome = 'action_created'
  and ai_summary is null
  and transcript is not null;
