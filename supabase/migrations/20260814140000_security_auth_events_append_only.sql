-- Live production finding (2026-08-14):
-- 20260814130000 revoked DELETE on security_auth_events from anon/authenticated,
-- but default grants still allowed INSERT / UPDATE / TRUNCATE (and SELECT for
-- authenticated). Writes and reads use the service-role admin client only
-- (src/lib/security-events.ts, /admin/security, data-retention cron).
-- Complete the append-only audit-log posture for JWT roles.

revoke all
  on table public.security_auth_events
  from anon, authenticated, public;

comment on table public.security_auth_events is
  'Security audit log. SERVICE ROLE ONLY. JWT roles (anon/authenticated) have no DML. Retain indefinitely.';
