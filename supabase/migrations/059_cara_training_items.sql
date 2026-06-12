-- Cara Training: knowledge gaps from calls / Action Inbox that owners resolve
-- into structured Cara Setup updates (FAQ, services, rules).

create table public.cara_training_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  status text not null default 'awaiting_answer'
    check (status in ('awaiting_answer', 'draft_ready', 'applied', 'dismissed')),
  source text not null
    check (source in ('call_gap', 'action_inbox', 'owner_initiated')),
  call_log_id uuid references public.call_logs (id) on delete set null,
  action_ticket_id uuid references public.action_tickets (id) on delete set null,
  gap_summary text not null,
  caller_context text,
  cara_question text not null,
  owner_messages jsonb not null default '[]'::jsonb,
  proposed_patch jsonb,
  applied_patch jsonb,
  target_section text
    check (
      target_section is null
      or target_section in ('faq', 'services', 'services_not_offered', 'business_rules')
    ),
  applied_at timestamptz,
  applied_by uuid references auth.users (id) on delete set null,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cara_training_items_organization_id_idx
  on public.cara_training_items (organization_id);

create index cara_training_items_org_status_created_idx
  on public.cara_training_items (organization_id, status, created_at desc);

create unique index cara_training_items_action_ticket_id_unique_idx
  on public.cara_training_items (action_ticket_id)
  where action_ticket_id is not null;

comment on table public.cara_training_items is
  'Owner-confirmed knowledge updates Cara learns from calls, Action Inbox, or manual teaching.';

alter table public.cara_training_items enable row level security;

create policy "cara_training_items_select_same_org"
  on public.cara_training_items
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

create policy "cara_training_items_insert_same_org"
  on public.cara_training_items
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

create policy "cara_training_items_update_same_org"
  on public.cara_training_items
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy "cara_training_items_delete_same_org"
  on public.cara_training_items
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

grant select, insert, update, delete on table public.cara_training_items to authenticated;

-- Realtime for nav badges and training page refresh.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cara_training_items'
  ) then
    alter publication supabase_realtime add table public.cara_training_items;
  end if;
end
$$;
