-- Persistent Cara chat per dashboard user (organization-scoped).

create table public.cara_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cara_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.cara_conversations (id) on delete cascade,
  role text not null constraint cara_messages_role_check check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index cara_conversations_org_user_updated_idx
  on public.cara_conversations (organization_id, user_id, updated_at desc);

create index cara_messages_conversation_created_idx
  on public.cara_messages (conversation_id, created_at asc);

alter table public.cara_conversations enable row level security;
alter table public.cara_messages enable row level security;

create policy "cara_conversations_select_own"
  on public.cara_conversations
  for select
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and user_id = auth.uid()
  );

create policy "cara_conversations_insert_own"
  on public.cara_conversations
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_organization_id()
    and user_id = auth.uid()
  );

create policy "cara_conversations_update_own"
  on public.cara_conversations
  for update
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and user_id = auth.uid()
  )
  with check (
    organization_id = public.current_user_organization_id()
    and user_id = auth.uid()
  );

create policy "cara_conversations_delete_own"
  on public.cara_conversations
  for delete
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and user_id = auth.uid()
  );

create policy "cara_messages_select_own"
  on public.cara_messages
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

create policy "cara_messages_insert_own"
  on public.cara_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.cara_conversations c
      where c.id = conversation_id
        and c.organization_id = public.current_user_organization_id()
        and c.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.cara_conversations to authenticated;
grant select, insert on table public.cara_messages to authenticated;

comment on table public.cara_conversations is 'Cara AI chat threads; one user may have many over time.';
comment on table public.cara_messages is 'Cara chat messages (user/assistant only; system context is not stored).';
