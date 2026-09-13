-- Separate butcher-counter weekly offers from pre-pack grocery promos.

alter table public.retail_weekly_offers
  add column if not exists offer_channel text not null default 'prepack'
    check (offer_channel in ('butcher_counter', 'prepack'));

create index if not exists retail_weekly_offers_banner_channel_idx
  on public.retail_weekly_offers (retail_banner, offer_channel);

comment on column public.retail_weekly_offers.offer_channel is
  'butcher_counter = fresh meat counter deals; prepack = packaged meat-aisle promos.';
