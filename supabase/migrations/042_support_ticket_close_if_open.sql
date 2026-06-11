-- Let salons close their own open tickets (mirrors support_ticket_reopen_if_closed).
create or replace function public.support_ticket_close_if_open(p_ticket_id uuid)
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
  set status = 'closed', updated_at = now()
  where t.id = p_ticket_id
    and t.organization_id = org
    and t.status = 'open';
end;
$$;

revoke all on function public.support_ticket_close_if_open(uuid) from public;
grant execute on function public.support_ticket_close_if_open(uuid) to authenticated;

comment on function public.support_ticket_close_if_open(uuid) is
  'Salon dashboard: mark an open support ticket closed for the caller org.';
