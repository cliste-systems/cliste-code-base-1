-- Stripe webhook event deduplication and one-assigned-DID-per-org guard.

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'Processed Stripe webhook event IDs — prevents duplicate side effects on retries.';

alter table public.stripe_webhook_events enable row level security;

create unique index if not exists phone_numbers_one_assigned_per_org
  on public.phone_numbers (organization_id)
  where status = 'assigned';
