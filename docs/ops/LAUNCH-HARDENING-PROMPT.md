# Launch hardening — working prompt and status

Canonical copy of the launch-hardening prompt (9 P0s, 10 P1s, P2 backlog) plus what we found when we compared it to this GitHub tree and to live production (`rtoebbwzwxcnscsxghww`, 2026-08-14).

Implementation of P0/P1 code lives on [`cursor/launch-hardening-1f34`](https://github.com/cliste-systems/cliste-code-base-1/pull/4). The three timestamped migrations from that work are already applied on production and are recorded in this repo as `20260814130000`–`20260814130200`. A follow-up grant hardening from the live probe is `20260814140000`.

## Status vs this tree and production (2026-08-14)

| Item | Prompt claim | Reality |
|------|----------------|---------|
| P0-1 destructive scripts | 21 scripts; `purge-all-tenants.ts` unwarned | ~18 scripts today. `purge-all-tenants.ts` exists. Guard is in PR #4, not on `main`. |
| P0-2 origin gate | Direct `*.vercel.app` bypasses Cloudflare | `app.hellocara.ie` currently 307 → `/authenticate` (Cloudflare). Origin-gate 403 is **not** deployed until PR #4 + Transform Rule. |
| P0-3 rate limit | Counters in `security_auth_events`; spoofable IP | `auth_rate_limit_counters` **exists on production** (applied 2026-08-14). JWT roles cannot execute the RPCs. |
| P0-4 Stripe replay | `processed_at` missing / always set | Column existed (`061`, `NOT NULL DEFAULT now()`). Live column is now **nullable, no default** after `20260814130100`. |
| P0-9 names | `sanitizePromptFreeText` at compile-cara-prompt.ts:205 | Maps to `compile-cara-prompt.ts` + `wrapUserContentForPrompt` / `prompt-tenant-boundary.ts` on PR #4. |
| P1-6 `listUsers(200)` | `inviteTeamMember` scans first 200 users | Current invite path uses `inviteUserByEmail`. PR #4 still adds `auth_user_id_by_email` (live). |
| P2 checklist | “Migrations 060–064”; tree at 082 | GitHub `main` **is** at 082 plus `20260610180000_…`. Checklist on `main` was stale. |
| P2 npm scripts | `reconnect:supabase` / `bootstrap:env` missing | Script **files** exist (`scripts/reconnect-supabase.ts`, `scripts/bootstrap-env-local.ts`); npm script names were missing on `main`. |
| Tenants | SuperValu pilot | Production has **no retail org**. Three “BRENDANS SALON” rows (`other` / `hair_salon` / `beauty`). See [RETAIL-PILOT-PLAN.md](../RETAIL-PILOT-PLAN.md). |

Live grant finding (not in the original prompt): after `20260814130000`, `security_auth_events` still allowed `INSERT`/`UPDATE`/`TRUNCATE` for `anon`/`authenticated`. `20260814140000` revokes those so the table matches the “service-role only, append-only” comment in `028`.

---

## Original prompt

Context: production Next.js 16 / React 19 multi-tenant SaaS (Hello Cara — AI voice receptionist) on Vercel + Supabase + Stripe + Twilio + LiveKit. It handles call transcripts, caller phone numbers, and volunteered special-category data under GDPR, in Ireland.

The codebase is already in good shape: no TODO/FIXME, no `console.log`, no `any`, RLS enabled on every table, CI pins action SHAs and runs lint + typecheck + build + test. Do not do a stylistic rewrite. Fix the specific defects below, in priority order.

House rules (from `AGENTS.md`):

- This Next.js version has breaking changes vs training data. Read `node_modules/next/dist/docs/` before writing code that touches config, middleware, instrumentation, or server actions.
- Ship real behaviour only — no placeholder UI, no controls that aren't wired end-to-end.
- Act via tools. Apply DDL with `apply_migration`, reads and one-off test rows with `execute_sql`. Do not ask the user to run SQL or open dashboards.
- Mark any test rows obviously (`[smoke test]`, `+1-555-SMOKE-TEST`, `RT-TEST-*`) and offer cleanup afterwards.

Definition of done for every item: `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm test` all pass. Add a regression test where the item says so. Work through P0 completely before starting P1.

### P0 — Launch blockers

#### P0-1. `scripts/purge-all-tenants.ts` can wipe production with one command

`scripts/purge-all-tenants.ts` loads `.env.local`, builds a service-role client, and deletes every auth user, account, and organization — with no confirmation prompt, no `--yes` flag, and no check on which Supabase project it is pointed at.

`docs/ops/ENV.md` instructs the operator to populate `.env.local` with keys pulled from the hosted Supabase project, and there is only one. So `npx tsx scripts/purge-all-tenants.ts`, run from a normal dev machine, destroys production.

Fix:

- Require an explicit `--yes-i-am-sure` flag and an interactive typed confirmation of the target project ref.
- Read the project ref out of `NEXT_PUBLIC_SUPABASE_URL` and print it in the confirmation prompt (`About to DELETE ALL TENANTS in <ref>. Type the ref to continue:`).
- Hard-refuse when the resolved project ref matches the production ref. Put the production ref in `CLISTE_PRODUCTION_SUPABASE_REF` and abort unless `CLISTE_ALLOW_DESTRUCTIVE_ON_PROD=1` is also set.
- Apply the same guard pattern to any other destructive script in `scripts/` (audit all of them — check `apply-remote-sql.ts` and `patch-stripe-webhook-events.ts` in particular).

#### P0-2. Vercel origin is directly reachable, bypassing all Cloudflare protection

`SECURITY_CLOUDFLARE.md` documents a solid WAF posture — Stripe-IP allowlist on the webhook, geo challenge on `/admin` + `/dashboard`, bot blocking, edge rate limiting. It also states under “Stuff I deliberately didn't do” that origin authentication was not implemented.

Every one of those rules is therefore optional for an attacker: requests sent straight to the `*.vercel.app` deployment URL skip the entire edge layer. This compounds with P0-3 — on a direct origin hit, `cf-connecting-ip` and `x-real-ip` are attacker-supplied.

Fix (shared-secret approach already described in that doc):

- Add a Cloudflare Transform Rule injecting a header, e.g. `x-cliste-edge: <random 32+ byte secret>`, on all proxied requests.
- In `middleware.ts`, when `NODE_ENV === "production"`, reject any request missing a timing-safe match against `CLISTE_EDGE_SHARED_SECRET` with a 403 — except for `/api/cron/*` (Vercel Cron calls the origin directly) and `/api/voice/*` (confirm the voice worker path; keep the existing bearer-secret check either way).
- Use the existing `timingSafeEqualUtf8` from `src/lib/timing-safe-equal.ts`.
- Document the new env var in `docs/ops/ENV.md` and add it to the deploy checklist.

#### P0-3. Rate limiting is defeatable via spoofed headers, and the email limiter doesn't limit by email

Three distinct defects in `src/lib/auth-rate-limit.ts`:

1. **Spoofable IP.** Trust Vercel’s `x-vercel-forwarded-for` (or the rightmost XFF hop) rather than `cf-connecting-ip` / `x-real-ip` on the origin. Pair with P0-2.
2. **User-agent in the fingerprint.** Rotating the UA string resets the counter. Remove UA from the fingerprint.
3. **The email-scoped limiter is not email-scoped.** `rateLimitFingerprint(h, "auth-email:" + email)` still folds in IP + UA. Add a fingerprint keyed on the identifier alone.

Also in the same pass:

- **Read-after-write race.** Move count+insert into a single Postgres function that returns the post-insert count atomically.
- **`clearRateLimit` deletes audit rows.** Rate-limit state does not belong in `security_auth_events`. Create dedicated `auth_rate_limit_counters` (RLS on, service-role only), leave `security_auth_events` append-only, then revoke DELETE (and other mutating grants) on it from JWT roles.

Add tests for fingerprint stability and for the atomic counter.

#### P0-4. Stripe webhook drops events permanently when a handler fails

`src/app/api/stripe/webhook/route.ts` inserts the dedupe row into `stripe_webhook_events` before dispatching. A 500 makes Stripe retry — and the retry hits the duplicate check and returns `{ received: true, duplicate: true }` without ever running the handler.

Fix: insert the row as unprocessed, claim it, run the handler, and set `processed_at` only on success. Treat `processed_at IS NULL` as replayable.

Add a test covering: first delivery fails → row not marked processed → retry executes the handler → row marked processed → third delivery is a no-op.

#### P0-5. File uploads over ~1 MB will fail in production

`MAX_BUSINESS_FILE_BYTES = 10 * 1024 * 1024` but `next.config.ts` never sets `experimental.serverActions.bodySizeLimit`. The Next.js default body limit is 1 MB.

Fix: read `node_modules/next/dist/docs/` for the current option name, set the limit to match `MAX_BUSINESS_FILE_BYTES` plus multipart overhead, treat `PROFILE_AVATAR_MAX_BYTES` (2 MB) the same way, and surface a real UI error when the framework rejects an oversized body.

#### P0-6. No error boundaries anywhere

Create branded `src/app/global-error.tsx` (must call `Sentry.captureException` and render its own `<html>/<body>`), `src/app/not-found.tsx`, and segment `error.tsx` under dashboard / onboarding / admin. Never render raw `error.message`; show `error.digest`.

#### P0-7. Client-side Sentry is almost certainly dead, and CSP blocks it

CSP `connect-src` has no Sentry ingest host, and `sentry.client.config.ts` may never load on `@sentry/nextjs` v10 (entrypoint is `instrumentation-client.ts`). Prefer `tunnelRoute` over widening CSP.

#### P0-8. Sentry captures PII with no scrubbing

Set `sendDefaultPii: false` in all three configs. Add a shared `beforeSend` that scrubs E.164 numbers, emails, and transcript-like strings. Audit `captureObservedError` call sites — IDs only. Confirm the Sentry project is EU-region hosted.

#### P0-9. Cara's prompt compiler has no real injection defence; file text bypasses it

Quote-escaping is not injection defence. Business-file extracted text skips even that. Wrap all interpolated tenant text in labelled untrusted regions, strip role markers, move PII acknowledgement server-side, and add a regression test that `Ignore all previous instructions` in a business file cannot read as an instruction in the compiled prompt.

### P1 — Fix before customers arrive

| ID | Defect |
|----|--------|
| P1-1 | Admin impersonation leaves no audit trail; banner cookie fails open. Require a reason, fail closed, 1h TTL, persistent banner. Document tenant notification in `docs/legal/ROPA.md`. |
| P1-2 | Full email written to logs on rate-limited sign-in (`login/actions.ts`). Use `maskEmailForLog`. |
| P1-3 | Audit-log client IP is spoofable (leftmost XFF) and inconsistent with the rate limiter. One shared `getTrustedClientIp`. |
| P1-4 | `AUTH_RATE_LIMIT_SALT` silently falls back to a public constant. Throw in production if unset. |
| P1-5 | ~78 env vars, 5 documented, zero validated at boot. Add `src/lib/env.ts` and import from `instrumentation.ts`. Assert dev-only escape hatches are off in production. |
| P1-6 | Duplicate-team-member check only inspects the first 200 auth users. Look up by email; paginate as fallback. |
| P1-7 | Invited users never reach `/dashboard/set-password` because auth callback ignores `?next=`. Honour a safe relative path. |
| P1-8 | Service-role Supabase client runs in Edge middleware on nearly every request (`legalAcceptRedirect`). Move the check into Node layouts. |
| P1-9 | `npm test` glob is `src/lib/**/*.test.ts` — app-level suites never run. Switch to recursive `src/**/*.test.ts`. |
| P1-10 | No tenant-isolation tests. Seed two orgs and assert org A cannot read or mutate org B. |

### P2 — Do soon after launch

- `docs/ops/PRODUCTION-CHECKLIST.md` is stale (060–064 vs tree at 082 + timestamped files). Rewrite it against reality.
- Migration numbering collides (`002`, `008`, `013`, `062`, `066`, `081`). Adopt timestamps going forward; do not renumber applied migrations.
- Broken documented commands: `npm run reconnect:supabase` / `npm run bootstrap:env`.
- 19 MB of unoptimized images in `/public`.
- No Node `engines` / `packageManager` pin.
- Duplicated cron/voice auth helpers.
- GDPR exports silently truncate at 5000 rows.
- SMS quota check-then-act race.
- Uploads trust the client-declared MIME type; no per-org storage cap.
- User enumeration on sign-in (`Confirm your email first`).
- Turnstile verification doesn't bind hostname / action / `remoteip`.
- Reflected text on `/authenticate?error=&message=`.
- Transcript redaction gaps: emails + card expiry.
- No `npm audit` / Dependabot in CI.
- `dashboard-session.ts` interpolates into a PostgREST `.or()` filter.

### Verification

- `npm run lint && npx tsc --noEmit && npm run build && npm test` — all green, and the test count reflects P1-9.
- Regression tests for P0-4, P0-9, P1-6, P1-10.
- Compiled-prompt review: tenant text sits inside a labelled untrusted region.
- Preview smokes: ~9 MB PDF upload, branded error page, Stripe replay, origin 403, rotating-UA lockout.
- `docs/ops/PRODUCTION-CHECKLIST.md` and `docs/ops/ENV.md` accurate.

Report back: what you fixed, what you deliberately deferred, and anything in this document you found to be wrong on closer inspection.
