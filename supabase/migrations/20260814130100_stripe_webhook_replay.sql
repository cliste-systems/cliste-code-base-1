-- Allow Stripe webhook retries when handler fails before marking processed.

alter table public.stripe_webhook_events
  alter column processed_at drop not null,
  alter column processed_at drop default;

comment on column public.stripe_webhook_events.processed_at is
  'Set when the handler completes successfully. NULL means replayable on Stripe retry.';
