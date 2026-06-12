-- Retired public storefront (migration 002) left anon SELECT + RLS policies on
-- tenant tables. The anon key ships in every browser bundle — revoke all
-- unintended public reads (GDPR: owner contacts, AI prompts, billing IDs).

-- ---------------------------------------------------------------------------
-- Drop legacy storefront anon RLS policies
-- ---------------------------------------------------------------------------

drop policy if exists "organizations_public_select_active" on public.organizations;
drop policy if exists "services_public_select_active_org" on public.services;
drop policy if exists service_categories_select_public on public.service_categories;
drop policy if exists service_addons_select_public on public.service_addons;

-- ---------------------------------------------------------------------------
-- Revoke anon SELECT on public tables (keep stripe_platform_prices for signup
-- tier display — harmless Stripe price-id catalog, server-read today).
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'v', 'm')
      and c.relname <> 'stripe_platform_prices'
  loop
    execute format('revoke select on table public.%I from anon', r.name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- salon-logos bucket — storefront retired; stop anonymous object reads
-- ---------------------------------------------------------------------------

drop policy if exists "salon_logos_public_select" on storage.objects;

update storage.buckets
set public = false
where id = 'salon-logos';

comment on table public.organizations is
  'Tenant location row. Anon/public storefront SELECT revoked in migration 064.';
