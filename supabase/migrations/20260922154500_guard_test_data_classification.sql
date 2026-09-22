update public.organizations
set is_internal_test = false,
    updated_at = now()
where slug = 'kavanaghs-supervalu-donegal-town';

create or replace function public.classify_internal_test_organization()
returns trigger
language plpgsql
as $$
begin
  if new.slug in ('hello-cara-baseline', 'hello-cara-demo')
     or new.slug like 'smoke-%'
     or new.slug like 'murphy-s-supervalu-%'
     or new.name ilike '[smoke test]%'
     or new.name in ('Murphy''s SuperValu', 'Murphy''s SuperValu Killarney')
  then
    new.is_internal_test := true;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_classify_internal_test on public.organizations;
create trigger organizations_classify_internal_test
before insert or update of name, slug on public.organizations
for each row execute function public.classify_internal_test_organization();

create or replace function public.classify_test_call_log()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.call_sid, '') like 'RT-TEST-%'
     or coalesce(new.call_sid, '') like 'KAV-TEST-%'
     or coalesce(new.call_sid, '') like 'DEMO-5PART-%'
     or coalesce(new.room_name, '') like 'text-rehearsal-%'
  then
    new.is_test_call := true;
  end if;

  if coalesce(new.room_name, '') like 'admin-demo-%'
     or coalesce(new.caller_number, '') = '+353870000001'
  then
    new.engineer_test_call := true;
  end if;

  return new;
end;
$$;

drop trigger if exists call_logs_classify_test_data on public.call_logs;
create trigger call_logs_classify_test_data
before insert or update of call_sid, room_name, caller_number on public.call_logs
for each row execute function public.classify_test_call_log();

create or replace function public.classify_test_usage_record()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.call_sid, '') like 'RT-TEST-USAGE-%'
     or coalesce(new.call_sid, '') like 'KAV-TEST-USAGE-%'
  then
    new.sync_skip_reason := 'test_data';
    new.synced_to_stripe_at := coalesce(new.synced_to_stripe_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists usage_records_classify_test_data on public.usage_records;
create trigger usage_records_classify_test_data
before insert or update of call_sid on public.usage_records
for each row execute function public.classify_test_usage_record();
