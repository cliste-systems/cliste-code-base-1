-- Persist owner-chosen folder assignments for Cara knowledge entries.

create table if not exists public.cara_knowledge_folder_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entry_id text not null,
  folder_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entry_id)
);

create index if not exists cara_knowledge_folder_assignments_org_folder_idx
  on public.cara_knowledge_folder_assignments (organization_id, folder_id);

comment on table public.cara_knowledge_folder_assignments is
  'Maps Cara knowledge entry ids to dashboard folder ids (general, department slug, unsorted).';

alter table public.cara_knowledge_folder_assignments enable row level security;

create policy "cara_knowledge_folder_assignments_select_same_org"
  on public.cara_knowledge_folder_assignments
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

create policy "cara_knowledge_folder_assignments_insert_same_org"
  on public.cara_knowledge_folder_assignments
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

create policy "cara_knowledge_folder_assignments_update_same_org"
  on public.cara_knowledge_folder_assignments
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy "cara_knowledge_folder_assignments_delete_same_org"
  on public.cara_knowledge_folder_assignments
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

grant select, insert, update, delete on table public.cara_knowledge_folder_assignments to authenticated;

alter table public.cara_training_items
  add column if not exists knowledge_folder_id text;

comment on column public.cara_training_items.knowledge_folder_id is
  'Target knowledge folder when this training item is applied (general, department slug, or unsorted).';
