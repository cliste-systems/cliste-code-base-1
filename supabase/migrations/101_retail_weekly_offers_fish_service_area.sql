-- Add fish counter / pre-pack fish as a first-class weekly-offers service area.

alter table public.retail_weekly_offers
  drop constraint if exists retail_weekly_offers_service_area_check;

alter table public.retail_weekly_offers
  add constraint retail_weekly_offers_service_area_check
  check (service_area in ('butcher', 'deli', 'produce', 'bakery', 'off_licence', 'grocery', 'fish'));

comment on column public.retail_weekly_offers.service_area is
  'Store service area: butcher, deli, fish, produce, bakery, off_licence, or grocery.';
