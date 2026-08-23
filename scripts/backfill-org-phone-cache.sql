-- Backfill organizations.phone_number from assigned phone_numbers rows (v2 phase 0)
update public.organizations o
set phone_number = p.e164
from public.phone_numbers p
where p.organization_id = o.id
  and p.status = 'assigned'
  and coalesce(btrim(o.phone_number), '') = '';

-- Report counts
select
  (select count(*)::int from public.organizations o
   join public.phone_numbers p on p.organization_id = o.id and p.status = 'assigned'
   where coalesce(btrim(o.phone_number), '') = '') as still_desynced,
  (select count(*)::int from public.organizations o
   join public.phone_numbers p on p.organization_id = o.id and p.status = 'assigned'
   where o.phone_number = p.e164) as synced_assigned,
  (select count(*)::int from public.organizations
   where is_active = true and status = 'active' and cara_online_since is not null
     and coalesce(btrim(phone_number), '') <> '') as active_with_phone_and_cara_online;
