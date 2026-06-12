-- Track why usage rows were skipped without marking them billed.

alter table public.usage_records
  add column if not exists sync_skip_reason text;

comment on column public.usage_records.sync_skip_reason is
  'Set when a row is intentionally not sent to Stripe (e.g. no_customer).';
