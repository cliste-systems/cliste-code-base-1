update public.retail_catalog_products
set service_area = 'butcher',
    fulfilment = 'prepack',
    updated_at = now()
where retail_banner = 'supervalu'
  and coalesce(category_breadcrumb, '') ilike '/categories/prepack/%'
  and (service_area <> 'butcher' or fulfilment <> 'prepack');

update public.retail_weekly_offers
set service_area = 'butcher',
    fulfilment = 'prepack',
    offer_channel = 'prepack'
where retail_banner = 'supervalu'
  and coalesce(category_breadcrumb, '') ilike '/categories/prepack/%'
  and (service_area <> 'butcher' or fulfilment <> 'prepack' or offer_channel <> 'prepack');
