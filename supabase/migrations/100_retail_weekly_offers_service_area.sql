-- Service-area classification for counter vs prepack weekly offers.

alter table public.retail_weekly_offers
  add column if not exists service_area text not null default 'grocery'
    check (service_area in ('butcher', 'deli', 'produce', 'bakery', 'off_licence', 'grocery')),
  add column if not exists fulfilment text not null default 'prepack'
    check (fulfilment in ('counter', 'prepack')),
  add column if not exists category_breadcrumb text,
  add column if not exists sell_by text,
  add column if not exists price_unit_type text,
  add column if not exists is_alcohol boolean not null default false,
  add column if not exists brand text;

create index if not exists retail_weekly_offers_banner_service_area_idx
  on public.retail_weekly_offers (retail_banner, service_area, fulfilment);

create index if not exists retail_weekly_offers_banner_alcohol_idx
  on public.retail_weekly_offers (retail_banner, is_alcohol)
  where is_alcohol = true;

comment on column public.retail_weekly_offers.service_area is
  'Store service area: butcher, deli, produce, bakery, off_licence, or grocery.';
comment on column public.retail_weekly_offers.fulfilment is
  'counter = fresh counter / sold by weight; prepack = packaged SKU.';

-- Backfill from legacy offer_channel + department heuristics.
update public.retail_weekly_offers
set
  service_area = case
    when offer_channel = 'butcher_counter' then 'butcher'
    when offer_channel = 'prepack' and department ilike '%deli%' then 'deli'
    when offer_channel = 'prepack' and department ilike '%butcher%' then 'butcher'
    else 'grocery'
  end,
  fulfilment = case
    when offer_channel = 'butcher_counter' then 'counter'
    else 'prepack'
  end
where service_area = 'grocery' and fulfilment = 'prepack';
