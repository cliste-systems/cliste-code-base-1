-- Audit trail for Cara knowledge changes (learn, edit, unlearn, temporary updates).

create table if not exists public.cara_knowledge_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'learned',
      'edited',
      'unlearned',
      'temporal_started',
      'temporal_ended',
      'temporal_expired',
      'temporal_cancelled'
    )
  ),
  category text,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  source text not null,
  actor_id uuid references auth.users (id) on delete set null,
  call_log_id uuid references public.call_logs (id) on delete set null,
  training_item_id uuid references public.cara_training_items (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cara_knowledge_events_org_created_idx
  on public.cara_knowledge_events (organization_id, created_at desc);

comment on table public.cara_knowledge_events is
  'Timeline of Cara knowledge changes for the owner dashboard history view.';

alter table public.cara_knowledge_events enable row level security;

drop policy if exists "cara_knowledge_events_select_same_org" on public.cara_knowledge_events;
create policy "cara_knowledge_events_select_same_org"
  on public.cara_knowledge_events
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

drop policy if exists "cara_knowledge_events_insert_same_org" on public.cara_knowledge_events;
create policy "cara_knowledge_events_insert_same_org"
  on public.cara_knowledge_events
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

grant select, insert on table public.cara_knowledge_events to authenticated;
