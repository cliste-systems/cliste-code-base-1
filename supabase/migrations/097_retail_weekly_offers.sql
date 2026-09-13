-- National / store weekly offer snapshots for retail Cara (SuperValu pilot).

create table if not exists public.retail_weekly_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  retail_banner text not null
    check (retail_banner in ('supervalu', 'centra', 'daybreak', 'eurospar', 'other')),
  sync_batch_id uuid not null,
  product_name text not null,
  department text not null default 'Grocery',
  current_price_eur numeric(10, 2) not null,
  was_price_eur numeric(10, 2),
  discount_label text,
  price_per_unit text,
  sku text,
  offer_week_start date not null,
  offer_week_end date not null,
  source_url text,
  search_text text not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists retail_weekly_offers_banner_batch_idx
  on public.retail_weekly_offers (retail_banner, sync_batch_id);

create index if not exists retail_weekly_offers_org_batch_idx
  on public.retail_weekly_offers (organization_id, sync_batch_id)
  where organization_id is not null;

create index if not exists retail_weekly_offers_search_text_idx
  on public.retail_weekly_offers (retail_banner, search_text);

alter table public.organizations
  add column if not exists offers_synced_at timestamptz,
  add column if not exists offers_sync_source text;

comment on table public.retail_weekly_offers is
  'Synced national/store weekly promotional prices — Cara quotes via search_weekly_offers only.';
comment on column public.organizations.offers_synced_at is
  'When weekly retail offers were last synced for this store.';
comment on column public.organizations.offers_sync_source is
  'Offer feed identifier, e.g. supervalu_national.';

alter table public.retail_weekly_offers enable row level security;

create policy "retail_weekly_offers_service_role_all"
  on public.retail_weekly_offers
  for all
  to service_role
  using (true)
  with check (true);

create policy "retail_weekly_offers_org_members_read"
  on public.retail_weekly_offers
  for select
  to authenticated
  using (
    organization_id is null
    or organization_id in (
      select p.organization_id from public.profiles p where p.id = auth.uid()
    )
  );
