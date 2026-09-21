-- Full retailer catalogue foundation: canonical products, store listings/prices, and structured promotions.
create extension if not exists pg_trgm with schema extensions;

alter table public.organizations
  add column if not exists retail_source_store_id text,
  add column if not exists catalog_synced_at timestamptz,
  add column if not exists catalog_sync_source text;

comment on column public.organizations.retail_source_store_id is
  'Retailer storefront/store identifier used to sync and query that location catalog (for SuperValu, the storefront gateway store id).';
comment on column public.organizations.catalog_synced_at is
  'When the full retail product catalog was last synced for the store source used by this organization.';
comment on column public.organizations.catalog_sync_source is
  'Full catalog feed identifier, e.g. supervalu_storefront.';

create table if not exists public.retail_catalog_products (
  id uuid primary key default gen_random_uuid(),
  retail_banner text not null check (retail_banner in ('supervalu','centra','daybreak','eurospar','other')),
  sku text not null,
  product_name text not null,
  brand text,
  department text not null default 'Grocery',
  category_breadcrumb text,
  service_area text not null default 'grocery'
    check (service_area in ('butcher','deli','fish','produce','bakery','off_licence','grocery')),
  fulfilment text not null default 'prepack'
    check (fulfilment in ('counter','prepack')),
  sell_by text,
  price_unit_type text,
  is_alcohol boolean not null default false,
  source_url text,
  search_text text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retail_banner, sku)
);

create index if not exists retail_catalog_products_banner_service_idx
  on public.retail_catalog_products (retail_banner, service_area, fulfilment);
create index if not exists retail_catalog_products_banner_department_idx
  on public.retail_catalog_products (retail_banner, department);
create index if not exists retail_catalog_products_search_trgm_idx
  on public.retail_catalog_products using gin (search_text extensions.gin_trgm_ops);

create table if not exists public.retail_store_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.retail_catalog_products(id) on delete cascade,
  source_store_id text not null,
  sync_batch_id uuid not null,
  regular_price_eur numeric(10,2),
  display_price_eur numeric(10,2),
  price_per_unit text,
  source_price_label text,
  source_price_source text,
  is_listed boolean not null default true,
  synced_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_store_id, product_id)
);

create index if not exists retail_store_products_store_listed_idx
  on public.retail_store_products (source_store_id, is_listed, product_id);
create index if not exists retail_store_products_product_idx
  on public.retail_store_products (product_id);
create index if not exists retail_store_products_sync_batch_idx
  on public.retail_store_products (source_store_id, sync_batch_id);

create table if not exists public.retail_promotions (
  id uuid primary key default gen_random_uuid(),
  store_product_id uuid not null references public.retail_store_products(id) on delete cascade,
  promotion_key text not null,
  promotion_type text not null
    check (promotion_type in ('loyalty','standard_offer','multibuy','percentage','other')),
  loyalty_required boolean not null default false,
  loyalty_program text,
  offer_price_eur numeric(10,2),
  regular_price_eur numeric(10,2),
  label text,
  description text,
  valid_from date not null,
  valid_to date not null,
  synced_at timestamptz not null default now(),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_product_id, promotion_key),
  check (valid_to >= valid_from)
);

create index if not exists retail_promotions_store_validity_idx
  on public.retail_promotions (store_product_id, valid_from, valid_to);
create index if not exists retail_promotions_loyalty_idx
  on public.retail_promotions (loyalty_required, loyalty_program)
  where loyalty_required = true;

create table if not exists public.retail_catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  retail_banner text not null,
  source_store_id text not null,
  sync_batch_id uuid not null unique,
  status text not null check (status in ('running','completed','failed')),
  product_count integer not null default 0,
  promotion_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists retail_catalog_sync_runs_store_started_idx
  on public.retail_catalog_sync_runs (retail_banner, source_store_id, started_at desc);

alter table public.retail_catalog_products enable row level security;
alter table public.retail_store_products enable row level security;
alter table public.retail_promotions enable row level security;
alter table public.retail_catalog_sync_runs enable row level security;

create policy "retail_catalog_products_service_role_all"
  on public.retail_catalog_products for all to service_role using (true) with check (true);
create policy "retail_store_products_service_role_all"
  on public.retail_store_products for all to service_role using (true) with check (true);
create policy "retail_promotions_service_role_all"
  on public.retail_promotions for all to service_role using (true) with check (true);
create policy "retail_catalog_sync_runs_service_role_all"
  on public.retail_catalog_sync_runs for all to service_role using (true) with check (true);

grant select, insert, update, delete on public.retail_catalog_products to service_role;
grant select, insert, update, delete on public.retail_store_products to service_role;
grant select, insert, update, delete on public.retail_promotions to service_role;
grant select, insert, update, delete on public.retail_catalog_sync_runs to service_role;
