create or replace function public.classify_internal_test_organization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slug in ('hello-cara-baseline', 'hello-cara-demo', 'murphy-s-supervalu')
     or new.slug like 'murphy-s-supervalu-%'
     or new.slug like 'smoke-%'
     or new.name ilike '[smoke test]%'
  then
    new.is_internal_test := true;
  end if;
  return new;
end;
$$;