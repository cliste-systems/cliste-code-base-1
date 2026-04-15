-- Extra storefront fields: location (Eircode + geocoded map), amenities, team display, reviews block, section toggles
alter table public.organizations
  add column if not exists storefront_eircode text,
  add column if not exists storefront_map_lat double precision,
  add column if not exists storefront_map_lng double precision,
  add column if not exists storefront_amenities jsonb not null default '[]'::jsonb,
  add column if not exists storefront_team_members jsonb not null default '[]'::jsonb,
  add column if not exists storefront_reviews_block jsonb,
  add column if not exists storefront_show_team boolean not null default true,
  add column if not exists storefront_show_map boolean not null default true,
  add column if not exists storefront_show_reviews boolean not null default true;

comment on column public.organizations.storefront_eircode is
  'Irish Eircode shown on the public booking page; used with address for map geocoding.';
comment on column public.organizations.storefront_map_lat is
  'Latitude from geocoding (Nominatim) when address/Eircode is saved.';
comment on column public.organizations.storefront_map_lng is
  'Longitude from geocoding when address/Eircode is saved.';
comment on column public.organizations.storefront_amenities is
  'JSON array of amenity label strings for the public storefront.';
comment on column public.organizations.storefront_team_members is
  'JSON array of { name, imageUrl? } for optional team showcase (display-only).';
comment on column public.organizations.storefront_reviews_block is
  'JSON object { score?: string, entries?: [{ name, body, relativeTime? }] } for reviews card.';
