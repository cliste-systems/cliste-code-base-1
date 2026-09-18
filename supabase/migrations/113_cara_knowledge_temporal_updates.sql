-- Temporary and scheduled Cara knowledge updates with override metadata.

create table if not exists public.cara_knowledge_temporal_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  body text not null,
  subject_type text not null check (
    subject_type in (
      'opening_hours',
      'faq',
      'business_rule',
      'notice',
      'availability',
      'price'
    )
  ),
  subject_ref text,
  subject_scope jsonb not null default '{}'::jsonb,
  override_preview jsonb,
  duration_mode text not null check (duration_mode in ('limited', 'ongoing')),
  effective_at timestamptz not null,
  expires_at timestamptz,
  review_reminder_at timestamptz,
  ended_at timestamptz,
  cancelled_at timestamptz,
  hours_override_id uuid references public.business_hours_overrides (id) on delete set null,
  training_item_id uuid references public.cara_training_items (id) on delete set null,
  classification jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cara_knowledge_temporal_expires_check check (
    duration_mode = 'ongoing' or expires_at is not null
  )
);

create index if not exists cara_knowledge_temporal_org_effective_idx
  on public.cara_knowledge_temporal_updates (organization_id, effective_at desc);

create index if not exists cara_knowledge_temporal_org_active_idx
  on public.cara_knowledge_temporal_updates (organization_id, ended_at, cancelled_at, expires_at);

comment on table public.cara_knowledge_temporal_updates is
  'Time-bound Cara knowledge that overrides or supplements normal facts during its validity window.';

alter table public.cara_knowledge_temporal_updates enable row level security;

create policy "cara_knowledge_temporal_select_same_org"
  on public.cara_knowledge_temporal_updates
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

create policy "cara_knowledge_temporal_insert_same_org"
  on public.cara_knowledge_temporal_updates
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

create policy "cara_knowledge_temporal_update_same_org"
  on public.cara_knowledge_temporal_updates
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

grant select, insert, update on table public.cara_knowledge_temporal_updates to authenticated;

alter table public.cara_training_items
  add column if not exists temporal_draft jsonb;

comment on column public.cara_training_items.temporal_draft is
  'Owner-chosen duration and override preview for a temporary knowledge teach flow.';

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'cara_knowledge_events'
  ) then
    alter table public.cara_knowledge_events
      drop constraint if exists cara_knowledge_events_event_type_check;

    alter table public.cara_knowledge_events
      add constraint cara_knowledge_events_event_type_check
      check (
        event_type in (
          'learned',
          'edited',
          'unlearned',
          'temporal_started',
          'temporal_ended',
          'temporal_expired',
          'temporal_cancelled'
        )
      );
  end if;
end $$;
