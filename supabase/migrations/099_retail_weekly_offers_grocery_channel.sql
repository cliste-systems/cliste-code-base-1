-- Full-store weekly offers: grocery channel + department browse index.

alter table public.retail_weekly_offers
  drop constraint if exists retail_weekly_offers_offer_channel_check;

alter table public.retail_weekly_offers
  add constraint retail_weekly_offers_offer_channel_check
  check (offer_channel in ('butcher_counter', 'prepack', 'grocery'));

create index if not exists retail_weekly_offers_banner_department_idx
  on public.retail_weekly_offers (retail_banner, department);

comment on column public.retail_weekly_offers.offer_channel is
  'butcher_counter = fresh meat counter; prepack = packaged meat aisle; grocery = all other synced promos.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'retail-offers',
  'retail-offers',
  false,
  5242880,
  array['application/json']
)
on conflict (id) do nothing;
