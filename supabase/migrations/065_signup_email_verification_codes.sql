-- App-owned 6-digit signup codes (SendGrid email). Supabase generateLink
-- still powers the one-click link; typed codes verify against this table.

create table if not exists public.signup_email_verification_codes (
  email text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_email_verification_codes_expires_idx
  on public.signup_email_verification_codes (expires_at);

alter table public.signup_email_verification_codes enable row level security;

comment on table public.signup_email_verification_codes is
  'Hashed 6-digit signup verification codes sent via SendGrid. Service role only.';
