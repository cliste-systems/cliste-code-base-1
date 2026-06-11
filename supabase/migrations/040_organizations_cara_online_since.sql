-- Track when Cara last entered the online state (active + live + phone).
-- Cleared on transition to offline; set on transition to online.

alter table public.organizations
  add column if not exists cara_online_since timestamptz;

comment on column public.organizations.cara_online_since is
  'When Cara last entered the online state (status active, is_active, phone assigned). Null when offline.';

create or replace function public.organizations_sync_cara_online_since()
returns trigger
language plpgsql
as $$
declare
  old_online boolean := false;
  new_online boolean;
begin
  if tg_op = 'UPDATE' then
    old_online :=
      old.status = 'active'
      and old.is_active
      and old.phone_number is not null
      and btrim(old.phone_number) <> '';
  end if;

  new_online :=
    new.status = 'active'
    and new.is_active
    and new.phone_number is not null
    and btrim(new.phone_number) <> '';

  if new_online and not old_online then
    new.cara_online_since := now();
  elsif not new_online then
    new.cara_online_since := null;
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_sync_cara_online_since on public.organizations;

create trigger organizations_sync_cara_online_since
  before insert or update of status, is_active, phone_number
  on public.organizations
  for each row
  execute function public.organizations_sync_cara_online_since();

update public.organizations
set cara_online_since = now()
where status = 'active'
  and is_active
  and phone_number is not null
  and btrim(phone_number) <> ''
  and cara_online_since is null;
