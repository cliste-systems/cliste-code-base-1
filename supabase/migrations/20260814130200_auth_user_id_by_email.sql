-- Targeted auth user lookup for team invites (avoids listUsers pagination bugs).

create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = auth, public
stable
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

comment on function public.auth_user_id_by_email(text) is
  'Service-role helper: resolve auth.users.id by email without scanning listUsers.';

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
