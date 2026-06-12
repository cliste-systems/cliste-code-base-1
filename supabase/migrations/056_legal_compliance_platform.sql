-- Caller privacy acknowledgement before go-live (controller obligation under Art 13 GDPR).

alter table public.organizations
  add column if not exists caller_privacy_acknowledged_at timestamptz;

comment on column public.organizations.caller_privacy_acknowledged_at is
  'When the business owner confirmed caller-facing privacy information (website or in-salon) before go-live.';

-- Platform config key-value store (service role only) for ops jobs e.g. sub-processor notifications.

create table if not exists public.platform_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_config enable row level security;

comment on table public.platform_config is
  'Internal platform metadata (sub-processor notify version, etc.). Service role only — no tenant policies.';
