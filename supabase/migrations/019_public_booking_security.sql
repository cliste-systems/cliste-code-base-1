-- OTP challenges and rate-limit events for anonymous public booking (service role only).

create table if not exists public.public_booking_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  phone_e164 text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count int not null default 0,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists public_booking_otp_lookup_idx
  on public.public_booking_otp_challenges (organization_id, phone_e164, created_at desc);

create index if not exists public_booking_otp_expires_idx
  on public.public_booking_otp_challenges (expires_at);

comment on table public.public_booking_otp_challenges is
  'SMS OTP verification for public booking; accessed only via service role.';

alter table public.public_booking_otp_challenges enable row level security;

create table if not exists public.public_booking_rate_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  organization_id uuid references public.organizations (id) on delete cascade,
  ip_hash text not null,
  phone_e164 text
);

create index if not exists public_booking_rate_events_ip_created_idx
  on public.public_booking_rate_events (ip_hash, created_at desc);

create index if not exists public_booking_rate_events_phone_created_idx
  on public.public_booking_rate_events (organization_id, phone_e164, created_at desc);

comment on table public.public_booking_rate_events is
  'Coarse rate limiting for public booking; IP hashed with server salt.';

alter table public.public_booking_rate_events enable row level security;
