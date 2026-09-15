-- Call recordings: MP4/MP3 audio in private Supabase Storage, linked from call_logs.

alter table public.call_logs
  add column if not exists audio_storage_path text;

comment on column public.call_logs.audio_storage_path is
  'Private storage path in call-recordings bucket ({organization_id}/{call_log_id}.mp3). Nulled after 30-day retention.';

create index if not exists call_logs_audio_storage_path_idx
  on public.call_logs (audio_storage_path)
  where audio_storage_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'call-recordings',
  'call-recordings',
  false,
  10485760,
  array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "call_recordings_storage_select" on storage.objects;
create policy "call_recordings_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'call-recordings'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  );

drop policy if exists "call_recordings_storage_delete" on storage.objects;
create policy "call_recordings_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'call-recordings'
    and (storage.foldername(name))[1] = public.current_user_organization_id()::text
  );
