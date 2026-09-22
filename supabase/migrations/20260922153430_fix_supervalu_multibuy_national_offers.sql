-- Fix national multibuy promotion consensus and weekly-offer projection.
-- Multibuy signatures intentionally have no single offer_price_eur, so NULL-safe
-- comparison is required when promoting repeated store observations to national.
-- The weekly offer row keeps the ordinary single-item price in current_price_eur
-- while discount_label carries the authoritative multibuy terms (e.g. 3 for €5).

create or replace function public.refresh_supervalu_national_scope()
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_national_products integer;
  v_national_offers integer;
begin
  update public.retail_catalog_products
  set fulfilment='counter',updated_at=now()
  where retail_banner='supervalu'
    and service_area in ('butcher','deli','fish')
    and category_breadcrumb is not null
    and (
      category_breadcrumb ilike '%/butcher%'
      or category_breadcrumb ilike '%/deli-counter%'
      or category_breadcrumb ilike '%/fish-counter%'
    )
    and category_breadcrumb not ilike '%prepack%'
    and fulfilment<>'counter';

  with presence as (
    select sp.product_id,count(distinct sp.source_store_id) store_count
    from public.retail_store_products sp
    where sp.is_listed=true
      and sp.source_price_source='supervalu_public_storefront'
    group by sp.product_id
  ),
  price_counts as (
    select sp.product_id,sp.regular_price_eur,
           count(distinct sp.source_store_id) price_store_count
    from public.retail_store_products sp
    where sp.is_listed=true
      and sp.source_price_source='supervalu_public_storefront'
      and sp.regular_price_eur is not null
    group by sp.product_id,sp.regular_price_eur
  ),
  ranked_prices as (
    select *,
      row_number() over (
        partition by product_id
        order by price_store_count desc,regular_price_eur
      ) rn
    from price_counts
  )
  update public.retail_catalog_products p
  set national_store_count=coalesce(pr.store_count,0),
      is_national=coalesce(pr.store_count,0)>=3,
      national_regular_price_eur=
        case when rp.price_store_count>=3 then rp.regular_price_eur else null end,
      national_regular_price_store_count=coalesce(rp.price_store_count,0),
      updated_at=now()
  from presence pr
  left join ranked_prices rp
    on rp.product_id=pr.product_id and rp.rn=1
  where p.id=pr.product_id;

  update public.retail_catalog_products p
  set national_store_count=0,
      is_national=false,
      national_regular_price_eur=null,
      national_regular_price_store_count=0,
      updated_at=now()
  where p.retail_banner='supervalu'
    and not exists (
      select 1
      from public.retail_store_products sp
      where sp.product_id=p.id
        and sp.is_listed=true
        and sp.source_price_source='supervalu_public_storefront'
    );

  update public.retail_promotions
  set scope='store',national_store_count=1
  where store_product_id in (
    select sp.id
    from public.retail_store_products sp
    join public.retail_catalog_products p on p.id=sp.product_id
    where p.retail_banner='supervalu'
  );

  with promo_observed as (
    select sp.product_id,rp.promotion_type,rp.loyalty_required,
           coalesce(rp.loyalty_program,'') loyalty_program,
           coalesce(rp.label,'') label,
           case when rp.promotion_type='multibuy' then null when rp.loyalty_required then rp.offer_price_eur else sp.display_price_eur end offer_price_eur,
           coalesce(sp.regular_price_eur,rp.regular_price_eur) regular_price_eur,
           rp.valid_from,rp.valid_to,
           count(distinct sp.source_store_id) stores
    from public.retail_promotions rp
    join public.retail_store_products sp on sp.id=rp.store_product_id
    where sp.source_price_source='supervalu_public_storefront'
    group by sp.product_id,rp.promotion_type,rp.loyalty_required,
             coalesce(rp.loyalty_program,''),coalesce(rp.label,''),
             case when rp.promotion_type='multibuy' then null when rp.loyalty_required then rp.offer_price_eur else sp.display_price_eur end,
             coalesce(sp.regular_price_eur,rp.regular_price_eur),
             rp.valid_from,rp.valid_to
    having count(distinct sp.source_store_id)>=3
  )
  update public.retail_promotions rp
  set scope='national',national_store_count=o.stores
  from public.retail_store_products sp,promo_observed o
  where rp.store_product_id=sp.id
    and sp.product_id=o.product_id
    and sp.source_price_source='supervalu_public_storefront'
    and rp.promotion_type=o.promotion_type
    and rp.loyalty_required=o.loyalty_required
    and coalesce(rp.loyalty_program,'')=o.loyalty_program
    and coalesce(rp.label,'')=o.label
    and (case when rp.promotion_type='multibuy' then null when rp.loyalty_required then rp.offer_price_eur else sp.display_price_eur end) is not distinct from o.offer_price_eur
    and coalesce(sp.regular_price_eur,rp.regular_price_eur)=o.regular_price_eur
    and rp.valid_from=o.valid_from
    and rp.valid_to=o.valid_to;

  delete from public.retail_weekly_offers
  where retail_banner='supervalu';

  with promo_observed as (
    select sp.product_id,rp.promotion_type,rp.loyalty_required,
           coalesce(rp.loyalty_program,'') loyalty_program,
           coalesce(rp.label,'') label,
           case when rp.promotion_type='multibuy' then null when rp.loyalty_required then rp.offer_price_eur else sp.display_price_eur end offer_price_eur,
           coalesce(sp.regular_price_eur,rp.regular_price_eur) regular_price_eur,
           rp.valid_from,rp.valid_to,
           count(distinct sp.source_store_id) stores,
           max(sp.price_per_unit) filter (where sp.price_per_unit is not null) price_per_unit
    from public.retail_promotions rp
    join public.retail_store_products sp on sp.id=rp.store_product_id
    where sp.source_price_source='supervalu_public_storefront'
      and rp.scope='national'
    group by sp.product_id,rp.promotion_type,rp.loyalty_required,
             coalesce(rp.loyalty_program,''),coalesce(rp.label,''),
             case when rp.promotion_type='multibuy' then null when rp.loyalty_required then rp.offer_price_eur else sp.display_price_eur end,
             coalesce(sp.regular_price_eur,rp.regular_price_eur),
             rp.valid_from,rp.valid_to
  ),
  ranked as (
    select *,
      row_number() over (
        partition by product_id
        order by loyalty_required desc,stores desc,promotion_type,label
      ) rn
    from promo_observed
  )
  insert into public.retail_weekly_offers (
    organization_id,retail_banner,sync_batch_id,product_name,department,
    current_price_eur,was_price_eur,discount_label,price_per_unit,sku,
    offer_week_start,offer_week_end,source_url,search_text,synced_at,
    offer_channel,service_area,fulfilment,category_breadcrumb,sell_by,
    price_unit_type,is_alcohol,brand,is_national,national_store_count
  )
  select null,'supervalu',v_batch,p.product_name,p.department,
         case when r.promotion_type='multibuy' then r.regular_price_eur else r.offer_price_eur end,
         case
           when r.regular_price_eur>r.offer_price_eur then r.regular_price_eur
           when r.stores>=5
            and legacy.regular_price_eur is not null
            and legacy.regular_price_eur>r.offer_price_eur
            and legacy.display_price_eur=r.offer_price_eur
           then legacy.regular_price_eur
           else null
         end,
         nullif(r.label,''),r.price_per_unit,p.sku,
         r.valid_from,r.valid_to,p.source_url,p.search_text,now(),
         case
           when p.service_area='butcher' and p.fulfilment='counter' then 'butcher_counter'
           when p.service_area='grocery' then 'grocery'
           else 'prepack'
         end,
         p.service_area,p.fulfilment,p.category_breadcrumb,p.sell_by,
         p.price_unit_type,p.is_alcohol,p.brand,true,r.stores
  from ranked r
  join public.retail_catalog_products p on p.id=r.product_id
  left join public.retail_store_products legacy
    on legacy.product_id=p.id
   and legacy.source_store_id='5550'
  where r.rn=1
    and p.is_national=true
    and (r.offer_price_eur is not null or (r.promotion_type='multibuy' and r.regular_price_eur is not null));

  select count(*) into v_national_products
  from public.retail_catalog_products
  where retail_banner='supervalu' and is_national=true;

  select count(*) into v_national_offers
  from public.retail_weekly_offers
  where retail_banner='supervalu' and is_national=true;

  update public.organizations
  set offers_sync_source='supervalu_consensus_national',
      offers_synced_at=now(),
      updated_at=now()
  where niche='retail' and retail_banner='supervalu';

  return jsonb_build_object(
    'national_products',v_national_products,
    'national_offers',v_national_offers,
    'sync_batch_id',v_batch
  );
end;
$$;



select public.refresh_supervalu_national_scope();
