# Operations environment variables

## Error monitoring

| Variable | Required | Notes |
|----------|----------|-------|
| `SENTRY_DSN` | Production | Server-side Sentry DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Client-side DSN (defaults to `SENTRY_DSN`) |

Configure Sentry alert rules for: Stripe webhook handler errors, `usage-sync` / `sms-usage-sync` `rowsFailed > 0`, voice webhook 5xx.

## Voice worker

| Variable | Required | Notes |
|----------|----------|-------|
| `CLISTE_VOICE_WEBHOOK_SECRET` | Yes | Shared with voice worker |

## Cron

| Variable | Required | Notes |
|----------|----------|-------|
| `CRON_SECRET` | Yes | Bearer token for `/api/cron/*` |

## Bot protection

| Variable | Required | Notes |
|----------|----------|-------|
| `TURNSTILE_SECRET_KEY` | Production | **Mandatory** for signup; also used on login when set |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Production | Widget site key |

## Signup email confirmation

| Variable | Required | Notes |
|----------|----------|-------|
| `SENDGRID_API_KEY` | Production | Sends signup confirmation link (with `SENDGRID_FROM_EMAIL`) |
| `SENDGRID_FROM_EMAIL` | Production | Platform sender for signup, invites, and system notices |
| `SENDGRID_FROM_NAME` | Optional | From name (defaults to Cliste) |
| `SENDGRID_API_URL` | Optional | Use `https://api.eu.sendgrid.com` with an EU SendGrid subuser |

Per-business owner notifications use `{org.slug}@clistesystems.ie` when SendGrid
domain authentication is enabled for `clistesystems.ie`. Verify with:

```bash
npx tsx scripts/verify-twilio-ie1-messaging.ts
```

| `TWILIO_SMS_FROM` | Production | Platform sender for owner alert SMS |
| `TWILIO_IE_SMS_URL` | Optional | Inbound SMS webhook on IE DIDs (not yet implemented) |

Caller-facing SMS during calls uses each org's assigned Irish DID via
`POST /api/voice/send-sms`. Pool numbers should have Twilio messaging region
`ie1` — configure on purchase and verify with:

```bash
npx tsx scripts/verify-twilio-ie1-messaging.ts --fix
```
| `NEXT_PUBLIC_APP_URL` | Production | `https://app.clistesystems.ie` — used in confirmation links |

Production signups use `email_confirm: false` and email a confirmation link before onboarding.

**Supabase Auth URLs:** production site URL `https://app.clistesystems.ie`, redirect `https://app.clistesystems.ie/auth/callback`. Agent/script patch (not dashboard):

```bash
# After `supabase login` or with SUPABASE_ACCESS_TOKEN in .env.local
npx tsx scripts/patch-supabase-auth-urls.ts
```

## Supabase MCP (Cursor)

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_ACCESS_TOKEN` | For MCP + remote SQL | [Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens). Also used by `scripts/apply-remote-sql.ts`. |

If Supabase MCP disconnects or times out in Cursor, reconnect without OAuth:

```bash
# Add SUPABASE_ACCESS_TOKEN to .env.local first, or:
npm run supabase:mcp-reconnect -- --login

npm run supabase:mcp-reconnect
```

Then **Reload Window** in Cursor and toggle **supabase** under Settings → Tools & MCP.

## Stripe webhooks

| Variable | Required | Notes |
|----------|----------|-------|
| `STRIPE_WEBHOOK_SECRET` | Production | Signature verification |
| `CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS` | Dev only | Ignored when `NODE_ENV=production` |

## Rate limiting

Cloudflare edge rules: re-run `python3 scripts/cloudflare-harden.py` after deploy.
Slow brute-force uses `security_auth_events` (no extra env).
