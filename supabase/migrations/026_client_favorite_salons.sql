-- Client (guest) favourites on book.clistesystems.ie.
-- The public directory + storefront render a heart icon; when the visitor is
-- signed into a client account, tapping it toggles the favourite. Past
-- bookings are matched by `appointments.customer_email = auth.user.email`,
-- so no schema change is needed on `appointments` for MVP.
create table if not exists public.client_favorite_salons (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create index if not exists client_favorite_salons_user_idx
  on public.client_favorite_salons (user_id, created_at desc);

create index if not exists client_favorite_salons_org_idx
  on public.client_favorite_salons (organization_id);

alter table public.client_favorite_salons enable row level security;

drop policy if exists client_favorite_salons_select_own on public.client_favorite_salons;
create policy client_favorite_salons_select_own on public.client_favorite_salons
  for select using (auth.uid() = user_id);

drop policy if exists client_favorite_salons_insert_own on public.client_favorite_salons;
create policy client_favorite_salons_insert_own on public.client_favorite_salons
  for insert with check (auth.uid() = user_id);

drop policy if exists client_favorite_salons_delete_own on public.client_favorite_salons;
create policy client_favorite_salons_delete_own on public.client_favorite_salons
  for delete using (auth.uid() = user_id);

comment on table public.client_favorite_salons is
  'Client-side favourites (hearts) on the public book.clistesystems.ie site. Users may only read/write their own rows; operators (service role) see all.';
