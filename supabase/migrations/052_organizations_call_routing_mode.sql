-- How calls reach Cara, chosen during onboarding "Your number" step.
--   cliste_number   → business advertises the Cliste DID; Cara answers directly.
--                     Transfer-to-human (fallback_number) is safe in this mode.
--   forward_all     → business keeps their published number and unconditionally
--                     forwards every call to the Cliste DID. No transfer (loop).
--   forward_missed  → business rings their own team first; only missed/busy calls
--                     divert to the Cliste DID (conditional forwarding).
-- Null means "not chosen yet"; the UI treats that as cliste_number.
alter table public.organizations
  add column if not exists call_routing_mode text;

alter table public.organizations
  drop constraint if exists organizations_call_routing_mode_check;

alter table public.organizations
  add constraint organizations_call_routing_mode_check
  check (
    call_routing_mode is null
    or call_routing_mode in ('cliste_number', 'forward_all', 'forward_missed')
  );

comment on column public.organizations.call_routing_mode is
  'How calls reach Cara: cliste_number (use our DID directly), forward_all (carrier forwards all calls to our DID), forward_missed (carrier forwards only missed/busy calls). Null = not chosen. Transfer-to-human (fallback_number) only applies to cliste_number.';
