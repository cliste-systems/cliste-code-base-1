create or replace function public.classify_test_usage_record()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.call_sid, '') like 'RT-TEST-USAGE-%'
     or coalesce(new.call_sid, '') like 'KAV-TEST-USAGE-%'
     or coalesce(new.room_name, '') like 'admin-demo-%'
     or coalesce(new.room_name, '') like 'text-rehearsal-%'
  then
    new.sync_skip_reason := 'test_data';
    new.synced_to_stripe_at := coalesce(new.synced_to_stripe_at, now());
  end if;
  return new;
end;
$$;