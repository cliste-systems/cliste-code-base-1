-- Track when the customer was sent a Stripe payment link (or shown the
-- inline Payment Element). Powers the "Awaiting payment — link sent X
-- min ago" badge on the dashboard bookings page so the salon can see
-- WHY a booking is unpaid (vs. pay-in-person, where payment_status is
-- left null).
--
-- Applied against the remote Supabase project via MCP; this file checks
-- the same change into git so fresh environments stay in sync.

alter table public.appointments
  add column if not exists payment_link_sent_at timestamptz;

comment on column public.appointments.payment_link_sent_at is
  'When the Stripe Checkout/PaymentIntent was first created for this booking — i.e. when we expected the customer to pay. Null = no online payment ever offered (treat as pay-in-person).';

-- Backfill for any bookings that already have a Stripe session/intent
-- but no timestamp — use created_at as a sane proxy so dashboards do
-- not show "—" for historical rows.
update public.appointments
  set payment_link_sent_at = created_at
  where payment_link_sent_at is null
    and (stripe_checkout_session_id is not null
         or stripe_payment_intent_id is not null);
