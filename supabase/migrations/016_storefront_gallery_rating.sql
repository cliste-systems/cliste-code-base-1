-- Public booking page: hero gallery (up to 3 URLs) and optional rating line for display.
alter table public.organizations
  add column if not exists storefront_gallery_urls jsonb not null default '[]'::jsonb;

alter table public.organizations
  add column if not exists storefront_rating_text text;

comment on column public.organizations.storefront_gallery_urls is
  'Up to 3 public HTTPS URLs for the native booking page cover gallery (salon-logos bucket or external).';

comment on column public.organizations.storefront_rating_text is
  'Optional one-line rating copy for the booking page, e.g. average from Google reviews.';
