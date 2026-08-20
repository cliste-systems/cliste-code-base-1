-- usage_records: Realtime for home minutes metric + usage page live refresh.

alter table public.usage_records replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'usage_records'
  ) then
    alter publication supabase_realtime add table public.usage_records;
  end if;
end
$$;
