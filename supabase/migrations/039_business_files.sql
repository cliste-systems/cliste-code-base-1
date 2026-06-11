-- Business knowledge files: one home in Cara Setup (answer from / send to callers).

create table if not exists public.business_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  file_name text not null,
  file_type text not null default 'other',
  mime_type text,
  storage_path text not null,
  size_bytes bigint,
  answer_enabled boolean not null default true,
  send_enabled boolean not null default false,
  processing_status text not null default 'ready'
    check (processing_status in ('ready', 'processing', 'needs_processing')),
  extracted_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_files_organization_id_idx
  on public.business_files (organization_id);

create index if not exists business_files_org_send_enabled_idx
  on public.business_files (organization_id)
  where send_enabled = true;

comment on table public.business_files is
  'Uploaded business documents for Cara Setup (knowledge) and Routing (send to callers).';

alter table public.business_files enable row level security;

create policy "business_files_select_same_org"
  on public.business_files
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

create policy "business_files_insert_same_org"
  on public.business_files
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

create policy "business_files_update_same_org"
  on public.business_files
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy "business_files_delete_same_org"
  on public.business_files
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

-- Private bucket; signed URLs for worker / delivery.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-files',
  'business-files',
  false,
  10485760,
  array[
    'application/pdf',
    'text/csv',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "business_files_storage_select" on storage.objects;
create policy "business_files_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'business-files'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  );

drop policy if exists "business_files_storage_insert" on storage.objects;
create policy "business_files_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'business-files'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  );

drop policy if exists "business_files_storage_delete" on storage.objects;
create policy "business_files_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'business-files'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  );
