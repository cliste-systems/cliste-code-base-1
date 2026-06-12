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
| `SENDGRID_FROM_EMAIL` | Production | Verified sender |
| `SENDGRID_FROM_NAME` | Optional | From name (defaults to Cliste) |
| `NEXT_PUBLIC_APP_URL` | Production | `https://app.clistesystems.ie` — used in confirmation links |

Production signups use `email_confirm: false` and email a confirmation link before onboarding.

**Supabase Auth URLs:** production site URL `https://app.clistesystems.ie`, redirect `https://app.clistesystems.ie/auth/callback`. Agent/script patch (not dashboard):

```bash
# After `supabase login` or with SUPABASE_ACCESS_TOKEN in .env.local
npx tsx scripts/patch-supabase-auth-urls.ts
```

## Stripe webhooks

| Variable | Required | Notes |
|----------|----------|-------|
| `STRIPE_WEBHOOK_SECRET` | Production | Signature verification |
| `CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS` | Dev only | Ignored when `NODE_ENV=production` |

## Rate limiting

Cloudflare edge rules: re-run `python3 scripts/cloudflare-harden.py` after deploy.
Slow brute-force uses `security_auth_events` (no extra env).
