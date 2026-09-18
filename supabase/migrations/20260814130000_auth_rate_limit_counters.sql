-- Dedicated auth rate-limit counters (service-role only). security_auth_events stays append-only.

create table if not exists public.auth_rate_limit_counters (
  scope text not null,
  fingerprint text not null,
  failure_count integer not null default 0,
  last_failure_at timestamptz not null default now(),
  locked_until timestamptz,
  primary key (scope, fingerprint)
);

create index if not exists auth_rate_limit_counters_locked_until_idx
  on public.auth_rate_limit_counters (locked_until)
  where locked_until is not null;

alter table public.auth_rate_limit_counters enable row level security;

comment on table public.auth_rate_limit_counters is
  'Mutable brute-force counters for auth endpoints. Not an audit log.';

-- Atomically record a failure and return post-insert status.
create or replace function public.auth_rate_limit_record_failure(
  p_scope text,
  p_fingerprint text,
  p_window_seconds integer,
  p_max_failures integer,
  p_lock_seconds integer,
  p_captcha_after integer
)
returns table (
  failure_count integer,
  locked_until timestamptz,
  retry_after_seconds integer,
  requires_captcha boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - make_interval(secs => p_window_seconds);
  v_count integer;
  v_last timestamptz;
  v_locked timestamptz;
  v_retry integer := 0;
  v_requires boolean := false;
begin
  insert into public.auth_rate_limit_counters as c (
    scope,
    fingerprint,
    failure_count,
    last_failure_at,
    locked_until
  )
  values (
    p_scope,
    p_fingerprint,
    1,
    v_now,
    null
  )
  on conflict (scope, fingerprint) do update
  set
    failure_count = case
      when c.last_failure_at < v_window_start then 1
      else c.failure_count + 1
    end,
    last_failure_at = v_now,
    locked_until = case
      when c.last_failure_at < v_window_start then null
      when c.failure_count + 1 >= p_max_failures
        then v_now + make_interval(secs => p_lock_seconds)
      else c.locked_until
    end
  returning c.failure_count, c.last_failure_at, c.locked_until
  into v_count, v_last, v_locked;

  if v_locked is not null and v_locked > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_locked - v_now)))::integer);
  end if;

  v_requires := v_count >= p_captcha_after;

  return query
  select v_count, v_locked, v_retry, v_requires;
end;
$$;

create or replace function public.auth_rate_limit_get_status(
  p_scope text,
  p_fingerprint text,
  p_window_seconds integer,
  p_max_failures integer,
  p_lock_seconds integer,
  p_captcha_after integer
)
returns table (
  failure_count integer,
  locked_until timestamptz,
  retry_after_seconds integer,
  requires_captcha boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - make_interval(secs => p_window_seconds);
  v_row public.auth_rate_limit_counters%rowtype;
  v_count integer := 0;
  v_locked timestamptz;
  v_retry integer := 0;
  v_requires boolean := false;
begin
  select * into v_row
  from public.auth_rate_limit_counters c
  where c.scope = p_scope and c.fingerprint = p_fingerprint;

  if found then
    if v_row.last_failure_at >= v_window_start then
      v_count := v_row.failure_count;
      v_locked := v_row.locked_until;
    end if;
  end if;

  if v_locked is not null and v_locked > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_locked - v_now)))::integer);
  end if;

  v_requires := v_count >= p_captcha_after;

  return query
  select v_count, v_locked, v_retry, v_requires;
end;
$$;

create or replace function public.auth_rate_limit_clear(
  p_scope text,
  p_fingerprint text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_rate_limit_counters
  where scope = p_scope and fingerprint = p_fingerprint;
$$;

revoke all on table public.auth_rate_limit_counters from public, anon, authenticated;
revoke all on function public.auth_rate_limit_record_failure from public, anon, authenticated;
revoke all on function public.auth_rate_limit_get_status from public, anon, authenticated;
revoke all on function public.auth_rate_limit_clear from public, anon, authenticated;

-- security_auth_events is append-only for audit.
revoke delete on table public.security_auth_events from authenticated, anon;
