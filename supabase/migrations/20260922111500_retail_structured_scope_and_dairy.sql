alter table public.retail_catalog_products
  drop constraint if exists retail_catalog_products_service_area_check;
alter table public.retail_catalog_products
  add constraint retail_catalog_products_service_area_check
  check (service_area = any (array[
    'butcher'::text,'deli'::text,'fish'::text,'produce'::text,
    'bakery'::text,'dairy'::text,'off_licence'::text,'grocery'::text
  ]));

alter table public.retail_weekly_offers
  drop constraint if exists retail_weekly_offers_service_area_check;
alter table public.retail_weekly_offers
  add constraint retail_weekly_offers_service_area_check
  check (service_area = any (array[
    'butcher'::text,'deli'::text,'fish'::text,'produce'::text,
    'bakery'::text,'dairy'::text,'off_licence'::text,'grocery'::text
  ]));

update public.retail_catalog_products
set service_area='dairy', fulfilment='prepack', updated_at=now()
where service_area='grocery'
  and (
    category_breadcrumb ilike '%/fresh-milk/%'
    or category_breadcrumb ilike '%/yogurts/%'
    or category_breadcrumb ilike '%/cheese/%'
    or category_breadcrumb ilike '%/butter-spreads/%'
    or category_breadcrumb ilike '%milk-yogurt-butter-eggs%'
    or category_breadcrumb ilike '%dairy-lactose-free%'
  )
  and coalesce(category_breadcrumb,'') not ilike '%/baby-milk/%'
  and coalesce(category_breadcrumb,'') not ilike '%/cat-kitten/%';

update public.retail_weekly_offers
set service_area='dairy', fulfilment='prepack'
where service_area='grocery'
  and (
    category_breadcrumb ilike '%/fresh-milk/%'
    or category_breadcrumb ilike '%/yogurts/%'
    or category_breadcrumb ilike '%/cheese/%'
    or category_breadcrumb ilike '%/butter-spreads/%'
    or category_breadcrumb ilike '%milk-yogurt-butter-eggs%'
    or category_breadcrumb ilike '%dairy-lactose-free%'
  )
  and coalesce(category_breadcrumb,'') not ilike '%/baby-milk/%'
  and coalesce(category_breadcrumb,'') not ilike '%/cat-kitten/%';

update public.retail_regression_scenarios
set expectations = jsonb_set(
      expectations,
      '{assistantMustNotInclude}',
      to_jsonb(array[
        'you can definitely place your order on the website and then collect it',
        'we don''t have a click and collect service here',
        'we do not have a click and collect service here',
        'click and collect is available',
        'click & collect is available'
      ]::text[]),
      true
    ),
    updated_at = now()
where active = true
  and slug like 'click-collect-%';
