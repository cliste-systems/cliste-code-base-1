-- Separate verified national SuperValu range/offers from store-local data.
-- National products require presence in at least 3 public SuperValu storefronts.
-- National offers require the same product/offer/price signature in at least 3 storefronts.

alter table public.retail_catalog_products
  add column if not exists is_national boolean not null default false,
  add column if not exists national_store_count integer not null default 0,
  add column if not exists national_regular_price_eur numeric(10,2),
  add column if not exists national_regular_price_store_count integer not null default 0;

alter table public.retail_promotions
  add column if not exists scope text not null default 'store',
  add column if not exists national_store_count integer not null default 1;

alter table public.retail_weekly_offers
  add column if not exists is_national boolean not null default false,
  add column if not exists national_store_count integer not null default 0;

create index if not exists retail_catalog_products_national_search_idx
  on public.retail_catalog_products using gin (search_text extensions.gin_trgm_ops)
  where is_national=true;

create index if not exists retail_weekly_offers_national_active_idx
  on public.retail_weekly_offers
  (retail_banner,offer_week_start,offer_week_end,service_area,fulfilment)
  where is_national=true;

create index if not exists retail_promotions_national_idx
  on public.retail_promotions (scope,valid_from,valid_to)
  where scope='national';
