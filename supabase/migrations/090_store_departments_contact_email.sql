alter table public.store_departments
  add column if not exists contact_email text;

comment on column public.store_departments.contact_email is
  'Department contact email — internal routing only, never spoken to callers.';
