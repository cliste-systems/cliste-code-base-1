alter table public.store_departments
  add column if not exists manager_name text;

comment on column public.store_departments.manager_name is
  'Department manager name — internal reference only, not spoken to callers.';
