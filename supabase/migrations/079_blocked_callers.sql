-- Org-scoped caller blocklist for spam / unwanted inbound calls.

alter table public.organizations
  add column if not exists block_anonymous_callers boolean not null default false;

comment on column public.organizations.block_anonymous_callers is
  'When true, inbound calls with caller_number +anonymous are rejected before Cara starts.';

create table if not exists public.blocked_callers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  caller_e164 text not null
    check (caller_e164 ~ '^\+\d{8,16}$'),
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, caller_e164)
);

create index if not exists blocked_callers_organization_id_created_at_idx
  on public.blocked_callers (organization_id, created_at desc);

comment on table public.blocked_callers is
  'Owner-managed blocklist of inbound caller numbers (E.164). Withheld callers use organizations.block_anonymous_callers.';

alter table public.blocked_callers enable row level security;

create policy "blocked_callers_select_account"
  on public.blocked_callers
  for select
  to authenticated
  using (
    organization_id in (
      select o.id from public.organizations o
      where o.account_id = public.current_user_account_id()
    )
  );

create policy "blocked_callers_insert_active_org"
  on public.blocked_callers
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

create policy "blocked_callers_delete_active_org"
  on public.blocked_callers
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

grant select, insert, delete on public.blocked_callers to authenticated;
