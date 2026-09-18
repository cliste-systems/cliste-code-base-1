-- Audit trail for Cara knowledge changes (learn, edit, unlearn).

create table public.cara_knowledge_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null check (event_type in ('learned', 'edited', 'unlearned')),
  category text,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  source text not null,
  actor_id uuid references auth.users (id) on delete set null,
  call_log_id uuid references public.call_logs (id) on delete set null,
  training_item_id uuid references public.cara_training_items (id) on delete set null,
  created_at timestamptz not null default now()
);

create index cara_knowledge_events_org_created_idx
  on public.cara_knowledge_events (organization_id, created_at desc);

comment on table public.cara_knowledge_events is
  'Timeline of Cara knowledge changes for the owner dashboard history view.';

alter table public.cara_knowledge_events enable row level security;

create policy "cara_knowledge_events_select_same_org"
  on public.cara_knowledge_events
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

grant select on table public.cara_knowledge_events to authenticated;
