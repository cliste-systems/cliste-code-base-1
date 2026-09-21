-- Store-specific product assortment overrides.
-- Absence of a row is deliberately "not confirmed"; we only persist explicit
-- store decisions so this remains sparse as catalogues/stores grow.
create table if not exists public.retail_store_product_assortment (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.retail_catalog_products(id) on delete cascade,
  status text not null check (status in ('stocked', 'not_stocked')),
  source text not null default 'dashboard',
  note text,
  confirmed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (organization_id, product_id)
);

comment on table public.retail_store_product_assortment is
  'Explicit store-level assortment decisions. No row means the store has not confirmed whether it normally stocks the product.';
comment on column public.retail_store_product_assortment.status is
  'stocked = normally carried by this store; not_stocked = store has explicitly said it does not normally carry the product. This is not live shelf inventory.';

create index if not exists retail_store_product_assortment_org_status_idx
  on public.retail_store_product_assortment (organization_id, status, updated_at desc);
create index if not exists retail_store_product_assortment_product_idx
  on public.retail_store_product_assortment (product_id, organization_id);

alter table public.retail_store_product_assortment enable row level security;

create policy "retail_store_product_assortment_service_role_all"
  on public.retail_store_product_assortment
  for all to service_role
  using (true)
  with check (true);

grant select, insert, update, delete
  on public.retail_store_product_assortment
  to service_role;
