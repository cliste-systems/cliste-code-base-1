-- Recorded contractual acceptances (terms, privacy, DPA) per user + organisation.

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_type text not null check (document_type in ('terms', 'privacy', 'dpa')),
  document_version text not null,
  ip_hash text,
  user_agent text
);

create index if not exists legal_acceptances_org_user_idx
  on public.legal_acceptances (organization_id, user_id, document_type, created_at desc);

create index if not exists legal_acceptances_user_created_idx
  on public.legal_acceptances (user_id, created_at desc);

comment on table public.legal_acceptances is
  'Audit trail of terms, privacy and DPA acceptances. SERVICE ROLE ONLY — written by server actions; no JWT policies on purpose.';

alter table public.legal_acceptances enable row level security;
