-- Cliste Systems — Step 2: core schema + RLS (paste into Supabase SQL Editor or run via CLI)
-- Requires: Supabase project with auth.users (default).
-- NOTE: Tables must exist BEFORE current_user_organization_id() — Postgres validates the function body.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tier text not null check (tier in ('connect', 'native')),
  phone_number text,
  fallback_number text,
  greeting text,
  custom_prompt text,
  fresha_url text,
  logo_url text,
  address text,
  bio_text text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role text not null default 'member',
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  caller_number text not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  outcome text not null,
  transcript text,
  created_at timestamptz not null default now()
);

create table public.action_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  caller_number text not null,
  summary text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint action_tickets_status_check check (status in ('open', 'resolved'))
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  category text,
  price numeric(12, 2) not null default 0,
  duration_minutes integer not null check (duration_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (tenant lookups)
-- ---------------------------------------------------------------------------
create index profiles_organization_id_idx on public.profiles (organization_id);
create index call_logs_organization_id_idx on public.call_logs (organization_id);
create index call_logs_created_at_idx on public.call_logs (created_at desc);
create index action_tickets_organization_id_idx on public.action_tickets (organization_id);
create index services_organization_id_idx on public.services (organization_id);

-- ---------------------------------------------------------------------------
-- Helper: current user's organization (after profiles exists; avoids RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id
  from public.profiles p
  where p.id = auth.uid();
$$;

comment on function public.current_user_organization_id() is
  'Returns the organization_id for the authenticated user; used by RLS policies.';

revoke all on function public.current_user_organization_id() from public;
grant execute on function public.current_user_organization_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.call_logs enable row level security;
alter table public.action_tickets enable row level security;
alter table public.services enable row level security;

-- organizations: members of the org can read/update their own org row
create policy "organizations_select_same_org"
  on public.organizations
  for select
  to authenticated
  using (id = public.current_user_organization_id());

create policy "organizations_update_same_org"
  on public.organizations
  for update
  to authenticated
  using (id = public.current_user_organization_id())
  with check (id = public.current_user_organization_id());

-- profiles: see teammates in the same org; update only your own row.
-- Inserts (and optional deletes) are done with the service_role key from your
-- server/onboarding flow so the first row does not depend on RLS recursion.
create policy "profiles_select_same_org"
  on public.profiles
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    and organization_id = public.current_user_organization_id()
  )
  with check (
    id = auth.uid()
    and organization_id = public.current_user_organization_id()
  );

-- call_logs: full CRUD within org
create policy "call_logs_select_same_org"
  on public.call_logs
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

create policy "call_logs_insert_same_org"
  on public.call_logs
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

create policy "call_logs_update_same_org"
  on public.call_logs
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy "call_logs_delete_same_org"
  on public.call_logs
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

-- action_tickets: full CRUD within org
create policy "action_tickets_select_same_org"
  on public.action_tickets
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

create policy "action_tickets_insert_same_org"
  on public.action_tickets
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

create policy "action_tickets_update_same_org"
  on public.action_tickets
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy "action_tickets_delete_same_org"
  on public.action_tickets
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

-- services: full CRUD within org
create policy "services_select_same_org"
  on public.services
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

create policy "services_insert_same_org"
  on public.services
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

create policy "services_update_same_org"
  on public.services
  for update
  to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy "services_delete_same_org"
  on public.services
  for delete
  to authenticated
  using (organization_id = public.current_user_organization_id());

-- ---------------------------------------------------------------------------
-- Grants (authenticated clients use the JS client with user JWT)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, update on table public.organizations to authenticated;

grant select, update on table public.profiles to authenticated;

grant select, insert, update, delete on table public.call_logs to authenticated;

grant select, insert, update, delete on table public.action_tickets to authenticated;

grant select, insert, update, delete on table public.services to authenticated;
