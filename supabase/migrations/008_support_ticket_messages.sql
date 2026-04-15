-- Threaded replies on support tickets (salon + Cliste admin).
create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_kind text not null
    constraint support_ticket_messages_author_check check (author_kind in ('salon', 'admin')),
  body text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_ticket_messages enable row level security;

create policy "support_ticket_messages_select_via_ticket"
  on public.support_ticket_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and t.organization_id = public.current_user_organization_id()
    )
  );

create policy "support_ticket_messages_insert_salon"
  on public.support_ticket_messages
  for insert
  to authenticated
  with check (
    author_kind = 'salon'
    and created_by = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and t.organization_id = public.current_user_organization_id()
    )
  );

grant select, insert on table public.support_ticket_messages to authenticated;

comment on table public.support_ticket_messages is
  'Conversation thread; admin rows inserted with service role (author_kind admin).';

-- Reopen a closed ticket when the salon follows up (no broad UPDATE grant on tickets).
create or replace function public.support_ticket_reopen_if_closed(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  select p.organization_id into org
  from public.profiles p
  where p.id = auth.uid();

  if org is null then
    raise exception 'not authenticated';
  end if;

  update public.support_tickets t
  set status = 'open', updated_at = now()
  where t.id = p_ticket_id
    and t.organization_id = org
    and t.status = 'closed';
end;
$$;

revoke all on function public.support_ticket_reopen_if_closed(uuid) from public;
grant execute on function public.support_ticket_reopen_if_closed(uuid) to authenticated;
