insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'salon-logos',
  'salon-logos',
  true,
  2097152,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "salon_logos_public_select" on storage.objects;
create policy "salon_logos_public_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'salon-logos');
