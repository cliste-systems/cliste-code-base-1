-- Widen organizations.niche to support all Cliste verticals (Ireland, non-regulated).
-- Backwards-compatible: column type/default unchanged, existing rows untouched.
-- agent_business_type remains the free-text vertical; niche drives dashboard
-- labelling and onboarding copy heuristics.

alter table public.organizations
  drop constraint if exists organizations_niche_check;

alter table public.organizations
  add constraint organizations_niche_check
  check (
    niche in (
      'hair_salon',
      'barber',
      'beauty',
      'trades',
      'home_services',
      'hospitality',
      'retail',
      'ecommerce',
      'professional_services',
      'fitness',
      'automotive',
      'events',
      'education',
      'other'
    )
  );

comment on column public.organizations.niche is
  'Business vertical for dashboard labelling + onboarding copy heuristics. Widened in 051 to all supported Irish verticals (medical/regulated handled separately and blocked at onboarding).';
