update public.retail_catalog_products
set service_area = 'dairy',
    fulfilment = 'prepack',
    updated_at = now()
where retail_banner = 'supervalu'
  and coalesce(category_breadcrumb, '') ilike '/categories/everyday-yogurts/%'
  and service_area <> 'dairy';

update public.retail_weekly_offers
set service_area = 'dairy',
    fulfilment = 'prepack',
    offer_channel = 'prepack'
where retail_banner = 'supervalu'
  and coalesce(category_breadcrumb, '') ilike '/categories/everyday-yogurts/%'
  and service_area <> 'dairy';
