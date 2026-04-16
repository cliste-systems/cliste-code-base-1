-- Fix for 023_admin_salon_demo_f94_directory_pin.sql.
-- The seed labelled Eircode F94 H002 as "Bundoran, Co. Donegal" and used
-- Bundoran's coordinates. That Eircode is actually in Tullaghacullion,
-- Co. Donegal (verified via Google Geocoding). Correct the pin so the map
-- and address line match.
update public.organizations
set
  address = 'Tullaghacullion, Co. Donegal',
  storefront_eircode = 'F94 H002',
  storefront_map_lat = 54.6576987,
  storefront_map_lng = -8.4069128,
  updated_at = now()
where slug = 'admin-salon';
