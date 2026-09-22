alter table public.organizations
  add column if not exists is_internal_test boolean not null default false;

comment on column public.organizations.is_internal_test is
  'True for Cliste/HelloCara demo, QA, smoke-test, or seeded organizations. Excluded from real platform metrics.';

create index if not exists organizations_internal_test_idx
  on public.organizations (is_internal_test, created_at desc);

update public.organizations
set is_internal_test = true,
    updated_at = now()
where is_internal_test = false
  and (
    slug in ('hello-cara-baseline', 'hello-cara-demo')
    or name ilike '[smoke test]%'
    or name in ('Hello Cara Baseline', 'Hello Cara Demo', 'Murphy''s SuperValu Killarney')
  );

update public.call_logs
set is_test_call = true
where is_test_call = false
  and (
    call_sid like 'RT-TEST-%'
    or call_sid like 'KAV-TEST-%'
    or call_sid like 'DEMO-5PART-%'
    or room_name like 'text-rehearsal-%'
  );

update public.usage_records
set sync_skip_reason = 'test_data',
    synced_to_stripe_at = coalesce(synced_to_stripe_at, now())
where (
    call_sid like 'RT-TEST-USAGE-%'
    or call_sid like 'KAV-TEST-USAGE-%'
  )
  and coalesce(sync_skip_reason, '') <> 'test_data';
