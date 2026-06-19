-- User profile avatars: column + public storage bucket.

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Public URL for the user profile photo in the profile-avatars bucket.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_avatars_storage_select" on storage.objects;
create policy "profile_avatars_storage_select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'profile-avatars');

drop policy if exists "profile_avatars_storage_insert" on storage.objects;
create policy "profile_avatars_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_avatars_storage_update" on storage.objects;
create policy "profile_avatars_storage_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_avatars_storage_delete" on storage.objects;
create policy "profile_avatars_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
