-- Cara UI-confirmed destructive actions (e.g. cancel appointment).

create table public.cara_pending_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.cara_conversations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  action_type text not null
    constraint cara_pending_actions_type_check
    check (action_type = 'cancel_appointment'),
  appointment_id uuid not null,
  summary text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index cara_pending_actions_conversation_idx
  on public.cara_pending_actions (conversation_id);

create index cara_pending_actions_expires_idx
  on public.cara_pending_actions (expires_at);

alter table public.cara_pending_actions enable row level security;

create policy "cara_pending_actions_select_own"
  on public.cara_pending_actions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.cara_conversations c
      where c.id = conversation_id
        and c.organization_id = public.current_user_organization_id()
        and c.user_id = auth.uid()
    )
  );

create policy "cara_pending_actions_insert_own"
  on public.cara_pending_actions
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_organization_id()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.cara_conversations c
      where c.id = conversation_id
        and c.organization_id = public.current_user_organization_id()
        and c.user_id = auth.uid()
    )
  );

create policy "cara_pending_actions_delete_own"
  on public.cara_pending_actions
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.cara_conversations c
      where c.id = conversation_id
        and c.organization_id = public.current_user_organization_id()
        and c.user_id = auth.uid()
    )
  );

grant select, insert, delete on table public.cara_pending_actions to authenticated;

comment on table public.cara_pending_actions is
  'Short-lived Cara-proposed actions awaiting explicit user confirmation in the dashboard UI.';
