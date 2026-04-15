-- Public anonymous reads for live storefront + social URLs on organizations
alter table public.organizations
  add column if not exists instagram_url text,
  add column if not exists facebook_url text;

grant usage on schema public to anon;
grant select on table public.organizations to anon;
grant select on table public.services to anon;

create policy "organizations_public_select_active"
  on public.organizations
  for select
  to anon
  using (is_active = true);

create policy "services_public_select_active_org"
  on public.services
  for select
  to anon
  using (
    exists (
      select 1
      from public.organizations o
      where o.id = services.organization_id
        and o.is_active = true
    )
  );
