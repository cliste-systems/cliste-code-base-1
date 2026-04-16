-- Public book directory + "nearest salon": pin the usual agency test tenant.
-- Coordinates match Nominatim for "Bundoran, Co. Donegal" (F94 routing area).
-- If your slug differs, run a one-off UPDATE or duplicate the WHERE clause.
update public.organizations
set
  address = 'Bundoran, Co. Donegal',
  storefront_eircode = 'F94 H002',
  storefront_map_lat = 54.4788836,
  storefront_map_lng = -8.2782520,
  updated_at = now()
where slug = 'admin-salon';
