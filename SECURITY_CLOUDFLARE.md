# Cloudflare hardening — status

Zone: `clistesystems.ie`
Last applied: 2026-04-17 via `scripts/cloudflare-harden.py` and direct API.

## Zone settings (live)

| Setting | Value |
|---|---|
| SSL mode | `strict` (Full Strict) |
| Minimum TLS version | 1.2 |
| TLS 1.3 | on (with 0-RTT) |
| Always Use HTTPS | on |
| Automatic HTTPS Rewrites | on |
| Opportunistic Encryption | on |
| HTTP/3 (QUIC) | on |
| HSTS | enabled, `max-age=31536000`, includeSubDomains, preload |
| Security Level | high |
| Browser Integrity Check | on |
| Challenge Passage | 1800s |
| Privacy Pass | on |
| Email Obfuscation | on |
| Server-Side Excludes | on |
| Brotli | on |
| IPv6 | on |
| WebSockets | on |

## What is applied (via API)

### Account IP list

- `cliste_stripe_webhook_ips` — the 15 source IPs Stripe publishes at
  <https://stripe.com/files/ips/ips_webhooks.json>. Re-run the script
  quarterly to refresh.

### WAF custom rules (phase `http_request_firewall_custom`)

1. **Block `/api/stripe/webhook` from non-Stripe IPs** — belt-and-braces in
   addition to the HMAC signature check inside the Next.js route.
2. **Managed Challenge on `/admin…` and `/dashboard…` from outside IE/GB** —
   set to Managed Challenge (not Block) so travel / mobile SIMs don't lock
   you out. Tighten to Block once comfortable.
3. **Block unusual HTTP methods** — anything other than
   GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS gets dropped at the edge.
4. **Block scraper + LLM-training bots by user-agent** — GPTBot, ClaudeBot,
   anthropic-ai, CCBot, Google-Extended, PerplexityBot, Bytespider,
   Amazonbot, ImagesiftBot, Omgili, DataForSeoBot, FacebookBot, AhrefsBot,
   SemrushBot. robots.txt blocks polite bots; this blocks the impolite
   ones too.
5. **Managed Challenge for empty-user-agent hits on admin/dashboard/auth
   paths** — common scanner fingerprint.

### Rate limit (phase `http_ratelimit`)

1. **Brute-force lockout** for `/admin-unlock`, `/dashboard-unlock`, and
   `/authenticate` POSTs: 5 hits in 10 s per IP → 429 for 10 s.

   The free plan caps both `period` and `mitigation_timeout` at 10 s and
   allows only 1 rule, so this rule only stops fast credential-stuffing.
   **Slow brute-force is covered in-app** by `src/lib/auth-rate-limit.ts`
   which locks for 15–30 minutes after a handful of failures.

## What still needs a human click (3 items)

Three things can't be flipped via the current API token, either because the
endpoint is enterprise-only (Bot Fight Mode), returned a Cloudflare-side 500
(Hotlink Protection), or the token doesn't carry DNS:Edit (DNSSEC).

1. **Security → Bots → Bot Fight Mode** → turn on.
   Stops most classic scrapers. Free-tier feature, dashboard only.
2. **Scrape Shield → Hotlink Protection** → turn on.
   Blocks other sites embedding images from `clistesystems.ie`. The API
   returned a 500 when we tried — it's dashboard-only for now.
3. **DNS → Settings → DNSSEC** → Enable.
   Cloudflare will then display a DS record. Log into
   **webhostingireland.ie** (the registrar), paste the DS record into the
   DNSSEC section, save. Come back to Cloudflare after ~24h and confirm it
   went **Active**.

Everything else is already applied.

## Stuff I deliberately didn't do

- **Zero Trust / Access SSO** in front of `/admin` — replacing the current
  password gate with Google-Workspace-backed Access is the strongest move,
  but it requires an identity provider decision and a user listing. Happy
  to wire it up when you're ready.
- **Authenticated Origin Pulls (mTLS) to Vercel** — Vercel doesn't support
  client-cert auth on Hobby/Team. The practical equivalent is a shared
  secret header in a Cloudflare Transform Rule checked by the Next.js
  middleware. Also available on request.
- **DMARC/SPF/DKIM** — needs coordination with whichever provider sends
  your outbound mail (SendGrid, Twilio, Google Workspace). A one-line
  `v=DMARC1; p=reject; rua=mailto:dmarc@clistesystems.ie` is the goal, but
  you want SPF/DKIM aligned first or legitimate mail gets rejected.

## Verification

```bash
# should return 403 / Stripe-IP block
curl -I https://clistesystems.ie/api/stripe/webhook

# should eventually 429 after 5 rapid hits
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://clistesystems.ie/dashboard-unlock
done
```

After you do the 7 dashboard steps above, also check:

- <https://securityheaders.com/?q=clistesystems.ie> — should be A+
- <https://www.ssllabs.com/ssltest/analyze.html?d=clistesystems.ie> — should be A+

## Re-running the script

```bash
# loads CLOUDFLARE_API_TOKEN etc. from .env.local
set -a && source .env.local && set +a
python3 scripts/cloudflare-harden.py
```

Do this quarterly, or after any Stripe IP update.
