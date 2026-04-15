-- Salon-submitted support requests (Cliste team handles via admin console).
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'open'
    constraint support_tickets_status_check check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_organization_id_idx
  on public.support_tickets (organization_id);
create index support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc);

alter table public.support_tickets enable row level security;

create policy "support_tickets_select_same_org"
  on public.support_tickets
  for select
  to authenticated
  using (organization_id = public.current_user_organization_id());

create policy "support_tickets_insert_same_org"
  on public.support_tickets
  for insert
  to authenticated
  with check (organization_id = public.current_user_organization_id());

grant select, insert on table public.support_tickets to authenticated;

comment on table public.support_tickets is
  'Help requests from salon dashboard; staff manage via service role / admin app.';
