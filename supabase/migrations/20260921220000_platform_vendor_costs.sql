-- Internal platform vendor costs (Cliste ops spend tracker).

create table if not exists public.platform_vendor_costs (
  id uuid primary key default gen_random_uuid(),
  vendor_key text not null unique,
  display_name text not null,
  amount_cents integer,
  currency text not null default 'EUR',
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual', 'usage')),
  billing_day smallint check (billing_day is null or (billing_day >= 1 and billing_day <= 28)),
  next_billing_date date,
  source text not null default 'manual'
    check (source in ('manual', 'api')),
  api_provider text check (api_provider is null or api_provider in ('openrouter', 'railway')),
  last_synced_at timestamptz,
  last_synced_amount_cents integer,
  last_sync_error text,
  dashboard_url text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_vendor_costs_active_idx
  on public.platform_vendor_costs (active, next_billing_date);

create index if not exists platform_vendor_costs_api_provider_idx
  on public.platform_vendor_costs (api_provider)
  where api_provider is not null;

comment on table public.platform_vendor_costs is
  'Cliste internal vendor subscriptions and usage costs. Service role only; admin console reads/writes.';

alter table public.platform_vendor_costs enable row level security;

insert into public.platform_vendor_costs (
  vendor_key,
  display_name,
  billing_cycle,
  source,
  api_provider,
  dashboard_url,
  notes
) values
  (
    'vercel',
    'Vercel Pro',
    'monthly',
    'manual',
    null,
    'https://vercel.com/account/billing',
    'Dashboard + serverless hosting.'
  ),
  (
    'supabase',
    'Supabase Pro',
    'monthly',
    'manual',
    null,
    'https://supabase.com/dashboard/project/_/settings/billing',
    'Database, auth, storage.'
  ),
  (
    'railway',
    'Railway (voice worker)',
    'usage',
    'api',
    'railway',
    'https://railway.app/account/billing',
    'Voice worker compute. Synced via Railway API.'
  ),
  (
    'livekit',
    'LiveKit Cloud',
    'usage',
    'manual',
    null,
    'https://cloud.livekit.io/projects/p_/settings/billing',
    'Realtime rooms, SIP, inference gateway.'
  ),
  (
    'openrouter',
    'OpenRouter',
    'usage',
    'api',
    'openrouter',
    'https://openrouter.ai/settings/credits',
    'LLM routing for text rehearsal / dev. Synced via OpenRouter API.'
  ),
  (
    'resend',
    'Resend',
    'monthly',
    'manual',
    null,
    'https://resend.com/settings/billing',
    'Transactional email.'
  ),
  (
    'sentry',
    'Sentry',
    'monthly',
    'manual',
    null,
    'https://sentry.io/settings/billing/',
    'Error monitoring.'
  ),
  (
    'cloudflare',
    'Cloudflare',
    'monthly',
    'manual',
    null,
    'https://dash.cloudflare.com/profile/billing',
    'DNS / CDN.'
  ),
  (
    'cursor',
    'Cursor',
    'monthly',
    'manual',
    null,
    'https://cursor.com/settings',
    'IDE subscription.'
  ),
  (
    'chatgpt',
    'ChatGPT',
    'monthly',
    'manual',
    null,
    'https://chatgpt.com/#settings/Account',
    'OpenAI Plus / team plan.'
  )
on conflict (vendor_key) do nothing;
