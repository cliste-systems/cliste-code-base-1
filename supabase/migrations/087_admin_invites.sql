-- Admin-led retail invite tracking (v2 phase 1)
-- Service-role only — no tenant RLS policies.

create table if not exists public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  recipient_name text,
  invited_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_invites_org_email_lower_idx
  on public.admin_invites (organization_id, lower(email));

create index if not exists admin_invites_organization_id_idx
  on public.admin_invites (organization_id);

alter table public.admin_invites enable row level security;

comment on table public.admin_invites is
  'Tracks admin-sent owner invites for retail provisioning. Service-role writes only.';
