# Production pilot checklist

Rewrite of the stale 060–064 list against the GitHub tree and live project `rtoebbwzwxcnscsxghww` on 2026-08-14. See [LAUNCH-HARDENING-PROMPT.md](./LAUNCH-HARDENING-PROMPT.md) and [RETAIL-PILOT-PLAN.md](../RETAIL-PILOT-PLAN.md).

## Schema (live)

Production already has:

- Numbered migrations through **082** (plus `20260610180000_organizations_agent_service_area_exclusions.sql`)
- Launch-hardening:
  - `20260814130000` `auth_rate_limit_counters` + atomic RPCs (service-role execute only)
  - `20260814130100` `stripe_webhook_events.processed_at` nullable, no default
  - `20260814130200` `auth_user_id_by_email`
  - `20260814140000` `security_auth_events` JWT roles revoked to append-only / service-role-only

Going forward, **timestamp filenames only**. Do not renumber applied files (`002`, `008`, `013`, `062`, `066`, `081` already collide).

## Before deploy

- [ ] **Billing alerts** configured — see [INFRASTRUCTURE-COSTS.md](./INFRASTRUCTURE-COSTS.md) (Vercel spend cap, Supabase usage, Railway limit)
- [x] Core schema through 082 present on production (verified table list 2026-08-14)
- [x] Launch-hardening migrations `20260814130000`–`20260814140000` applied
- [ ] `SENTRY_DSN` set; alert rules configured; Sentry project is **EU-region**
- [ ] `CRON_SECRET`, Stripe, **SendGrid** (signup confirmation email), **Turnstile** keys set on Vercel
- [ ] `STRIPE_WEBHOOK_SECRET` set; `CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS` unset in production
- [ ] `AUTH_RATE_LIMIT_SALT`, `CLISTE_EDGE_SHARED_SECRET`, `CLISTE_SUPPORT_DASHBOARD_SECRET` set on Vercel
- [ ] Cloudflare Transform Rule adds `x-cliste-edge: <CLISTE_EDGE_SHARED_SECRET>` on `app.hellocara.ie` (see [SECURITY_CLOUDFLARE.md](../../SECURITY_CLOUDFLARE.md))
- [ ] Direct `*.vercel.app` origin returns **403** (P0-2). Today `app.hellocara.ie` still 307s to `/authenticate` — origin gate is on PR #4, not deployed.
- [ ] `python3 scripts/cloudflare-harden.py` run (rate-limit paths updated)
- [ ] Voice worker deployed with `call_sid`, `is_active` gate, E.164 callers
- [ ] Auth site URL is `https://app.hellocara.ie` (patched 2026-08-14); redirect allow-list includes `/auth/callback`
- [ ] `PUBLIC_SIGNUP_ENABLED` unset in production (retail pilot is admin-provisioned)

## Retail pilot

- [ ] Restore the `retail` vertical pack on current `VerticalPack` (lost in the Hello Cara merge — see the plan)
- [ ] Provision Kavanaghs SuperValu Donegal Town from `/admin` (`niche=retail`, pool DID, manual plan)
- [ ] Confirm production currently has **no retail org** (only three BRENDANS SALON rows)

## After deploy

- [ ] Run `npx tsx scripts/backfill-usage-sync.ts` once if pre-customer rows were marked synced
- [ ] Verify `POST /api/voice/call-complete` idempotent retry (same `call_sid` → same `call_log_id`); worker sends `call_sid` on every call
- [x] Anon REST probe: `GET /rest/v1/organizations?select=id&limit=1` returns permission denied (migration 064; re-checked 2026-08-14)
- [ ] Check `/admin/security` for pipeline incidents + disclosure %
- [ ] Confirm usage alert email at 80%/100% (or dry-run cron locally)
- [ ] Hit origin without `x-cliste-edge` → 403; 20 failed logins with rotating UA still lock out

## CI

- `npm run lint`, `tsc --noEmit`, `npm run build`, `npm test` must pass on PRs.
- Test glob should eventually be `src/**/*.test.ts` (P1-9; still `src/lib/**/*.test.ts` on `main`).
