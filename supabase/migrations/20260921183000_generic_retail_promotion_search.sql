-- Generic consensus-backed retailer promotion search for voice queries.
-- Promotion mechanics are queried from raw storefront observations instead of
-- forcing every deal into a single per-item "offer price".

create or replace function public.search_retail_promotions_consensus(
  p_retail_banner text,
  p_mechanic text,
  p_loyalty_required boolean default false,
  p_quantity numeric default null,
  p_total_eur numeric default null,
  p_percent numeric default null,
  p_amount_eur numeric default null,
  p_named_phrase text default null,
  p_service_area text default null,
  p_fulfilment text default null,
  p_subject_tokens text[] default '{}'::text[],
  p_reference_date date default current_date,
  p_limit integer default 16
)
returns table (
  product_id uuid,
  product_name text,
  department text,
  sku text,
  service_area text,
  fulfilment text,
  is_alcohol boolean,
  promotion_type text,
  loyalty_required boolean,
  loyalty_program text,
  label text,
  description text,
  offer_price_eur numeric,
  regular_price_eur numeric,
  display_price_eur numeric,
  price_per_unit text,
  source_store_count integer,
  valid_from date,
  valid_to date,
  source_metadata jsonb
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
with candidates as (
  select
    p.id as product_id,
    p.product_name,
    p.department,
    p.sku,
    p.service_area,
    p.fulfilment,
    p.is_alcohol,
    p.search_text,
    sp.source_store_id,
    sp.display_price_eur,
    sp.price_per_unit,
    coalesce(sp.regular_price_eur, rp.regular_price_eur) as regular_price_eur,
    rp.promotion_type,
    rp.loyalty_required,
    rp.loyalty_program,
    rp.label,
    rp.description,
    rp.offer_price_eur,
    rp.valid_from,
    rp.valid_to,
    rp.source_metadata,
    case
      when rp.promotion_type='multibuy'
        or coalesce(rp.label,'') ~* '^\s*[0-9]+\s+for\s+'
      then null
      else coalesce(rp.offer_price_eur, sp.display_price_eur)
    end as effective_offer_price_eur,
    coalesce(
      nullif(rp.source_metadata->>'multibuy_quantity','')::numeric,
      ((regexp_match(coalesce(rp.label,''), '(?i)([0-9]+)\s+for\s+(?:€\s*)?([0-9]+(?:[.,][0-9]{1,2})?)'))[1])::numeric
    ) as multibuy_quantity,
    coalesce(
      nullif(rp.source_metadata->>'multibuy_total_eur','')::numeric,
      replace(((regexp_match(coalesce(rp.label,''), '(?i)([0-9]+)\s+for\s+(?:€\s*)?([0-9]+(?:[.,][0-9]{1,2})?)'))[2]), ',', '.')::numeric
    ) as multibuy_total_eur,
    coalesce(
      nullif(rp.source_metadata->>'save_percent','')::numeric,
      replace(((regexp_match(coalesce(rp.label,''), '(?i)save\s+([0-9]+(?:[.,][0-9]+)?)\s*%'))[1]), ',', '.')::numeric
    ) as save_percent,
    coalesce(
      nullif(rp.source_metadata->>'save_amount_eur','')::numeric,
      replace(((regexp_match(coalesce(rp.label,''), '(?i)save\s+€\s*([0-9]+(?:[.,][0-9]{1,2})?)'))[1]), ',', '.')::numeric,
      (((regexp_match(coalesce(rp.label,''), '(?i)save\s+([0-9]{1,2})\s*c\b'))[1])::numeric / 100)
    ) as save_amount_eur
  from public.retail_promotions rp
  join public.retail_store_products sp on sp.id=rp.store_product_id
  join public.retail_catalog_products p on p.id=sp.product_id
  where p.retail_banner=p_retail_banner
    and p.is_national=true
    and sp.is_listed=true
    and sp.source_price_source='supervalu_public_storefront'
    and rp.valid_from <= p_reference_date
    and rp.valid_to >= p_reference_date
    and (p_service_area is null or p.service_area=p_service_area)
    and (p_fulfilment is null or p.fulfilment=p_fulfilment)
    and (
      coalesce(cardinality(p_subject_tokens),0)=0
      or not exists (
        select 1
        from unnest(p_subject_tokens) token
        where p.search_text not ilike '%' || token || '%'
      )
    )
),
filtered as (
  select *
  from candidates c
  where
    (not p_loyalty_required or c.loyalty_required=true)
    and (
      p_mechanic is null
      or p_mechanic='generic'
      or (
        p_mechanic='multibuy'
        and (
          c.promotion_type='multibuy'
          or coalesce(c.label,'') ~* '^\s*[0-9]+\s+for\s+'
        )
        and (p_quantity is null or c.multibuy_quantity=p_quantity)
        and (
          p_total_eur is null
          or abs(c.multibuy_total_eur-p_total_eur) <= 0.02
        )
      )
      or (
        p_mechanic='loyalty'
        and c.loyalty_required=true
      )
      or (
        p_mechanic='half_price'
        and (
          coalesce(c.label,'') ~* 'half\s+price'
          or c.save_percent=50
          or coalesce(c.label,'') ~* '50\s*%\s*off'
        )
      )
      or (
        p_mechanic='save_percent'
        and c.save_percent is not null
        and (p_percent is null or abs(c.save_percent-p_percent) <= 0.01)
      )
      or (
        p_mechanic='save_amount'
        and c.save_amount_eur is not null
        and (p_amount_eur is null or abs(c.save_amount_eur-p_amount_eur) <= 0.01)
      )
      or (
        p_mechanic='fixed_price'
        and coalesce(c.label,'') ~* '^\s*only\b'
        and (
          p_amount_eur is null
          or abs(coalesce(c.offer_price_eur,c.display_price_eur)-p_amount_eur) <= 0.02
        )
      )
      or (
        p_mechanic='named'
        and p_named_phrase is not null
        and lower(coalesce(c.label,'') || ' ' || coalesce(c.description,''))
          like '%' || lower(p_named_phrase) || '%'
      )
    )
),
consensus as (
  select
    f.product_id,
    f.product_name,
    f.department,
    f.sku,
    f.service_area,
    f.fulfilment,
    f.is_alcohol,
    f.promotion_type,
    f.loyalty_required,
    f.loyalty_program,
    f.label,
    f.description,
    f.effective_offer_price_eur,
    f.regular_price_eur,
    f.valid_from,
    f.valid_to,
    count(distinct f.source_store_id)::integer as source_store_count,
    max(f.display_price_eur) as display_price_eur,
    max(f.price_per_unit) as price_per_unit,
    (array_agg(f.source_metadata order by f.source_store_id))[1] as source_metadata
  from filtered f
  group by
    f.product_id,
    f.product_name,
    f.department,
    f.sku,
    f.service_area,
    f.fulfilment,
    f.is_alcohol,
    f.promotion_type,
    f.loyalty_required,
    f.loyalty_program,
    f.label,
    f.description,
    f.effective_offer_price_eur,
    f.regular_price_eur,
    f.valid_from,
    f.valid_to
  having count(distinct f.source_store_id) >= 3
)
select
  c.product_id,
  c.product_name,
  c.department,
  c.sku,
  c.service_area,
  c.fulfilment,
  c.is_alcohol,
  c.promotion_type,
  c.loyalty_required,
  c.loyalty_program,
  c.label,
  c.description,
  c.effective_offer_price_eur as offer_price_eur,
  c.regular_price_eur,
  c.display_price_eur,
  c.price_per_unit,
  c.source_store_count,
  c.valid_from,
  c.valid_to,
  c.source_metadata
from consensus c
order by c.source_store_count desc, c.department, c.product_name
limit greatest(1,least(coalesce(p_limit,16),50));
$$;

revoke all on function public.search_retail_promotions_consensus(
  text,text,boolean,numeric,numeric,numeric,numeric,text,text,text,text[],date,integer
) from public,anon,authenticated;

grant execute on function public.search_retail_promotions_consensus(
  text,text,boolean,numeric,numeric,numeric,numeric,text,text,text,text[],date,integer
) to service_role;

comment on function public.search_retail_promotions_consensus(
  text,text,boolean,numeric,numeric,numeric,numeric,text,text,text,text[],date,integer
) is
  'Consensus-backed generic retail promotion search. Supports multibuy, loyalty, half-price, percentage, money-off, fixed-price and named promotion mechanics without flattening bundle offers into per-item prices.';
