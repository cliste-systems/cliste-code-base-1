-- Retail store identity fields for SuperValu-style pilot provisioning.

alter table public.organizations
  add column if not exists store_code text,
  add column if not exists retail_banner text
    check (retail_banner is null or retail_banner in (
      'supervalu', 'centra', 'daybreak', 'eurospar', 'other'
    )),
  add column if not exists store_public_number text,
  add column if not exists divert_carrier text
    check (divert_carrier is null or divert_carrier in (
      'eir', 'vodafone', 'three', 'virgin', 'other'
    )),
  add column if not exists divert_verified_at timestamptz,
  add column if not exists divert_verified_by uuid references public.profiles (id) on delete set null,
  add column if not exists retail_facilities text[] not null default '{}',
  add column if not exists retail_delivery jsonb not null default '{}'::jsonb,
  add column if not exists retail_click_collect_url text,
  add column if not exists retail_loyalty_program text;

comment on column public.organizations.store_code is
  'Musgrave/franchise store number for support and invoicing.';
comment on column public.organizations.retail_banner is
  'Retail banner (supervalu, centra, etc.) — drives greeting wording.';
comment on column public.organizations.store_public_number is
  'Published landline on the door — distinct from Cliste DID (phone_number).';
comment on column public.organizations.divert_carrier is
  'Landline carrier used to configure call divert to the Cliste DID.';
comment on column public.organizations.divert_verified_at is
  'When an engineer verified live divert by ringing the store line.';
comment on column public.organizations.retail_facilities is
  'Checkbox set: parking, atm, post_office, wheelchair_access, etc.';
comment on column public.organizations.retail_delivery is
  'JSON: enabled, area, cut_off, min_spend for store delivery facts.';

-- Backfill agent location from legacy address fields where missing.
update public.organizations
set
  agent_location_address = coalesce(nullif(trim(agent_location_address), ''), nullif(trim(address), '')),
  agent_location_eircode = coalesce(nullif(trim(agent_location_eircode), ''), nullif(trim(storefront_eircode), ''))
where
  (agent_location_address is null or trim(agent_location_address) = '')
  or (agent_location_eircode is null or trim(agent_location_eircode) = '');
