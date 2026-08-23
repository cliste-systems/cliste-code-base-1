-- Distinguish Cliste-managed custom jobs from self-serve SaaS accounts.

alter table public.accounts
  add column if not exists provision_source text not null default 'managed'
  check (provision_source in ('managed', 'self_serve'));

create index if not exists accounts_provision_source_idx
  on public.accounts (provision_source);

comment on column public.accounts.provision_source is
  'managed = Cliste-led provisioning; self_serve = customer signup wizard.';

-- Self-serve signups record signup_ip on the account.
update public.accounts
set provision_source = 'self_serve'
where signup_ip is not null;

-- Admin invites mark managed clients (primary location).
update public.accounts a
set provision_source = 'managed'
from public.organizations o
inner join public.admin_invites ai on ai.organization_id = o.id
where o.account_id = a.id
  and coalesce(o.is_primary_location, true) = true;
