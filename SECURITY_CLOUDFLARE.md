# Cloudflare hardening — status

Zone: `clistesystems.ie`
Last applied: 2026-04-17 via `scripts/cloudflare-harden.py`.

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

## What the current token cannot do (needs dashboard or a wider token)

The token we used has these scopes: Zone:Read, WAF:Edit, Account Filter
Lists:Edit, Account Rulesets:Read. That is enough for everything above but
blocks the zone-settings category below.

### Do these in the Cloudflare dashboard — 5 minutes

1. **SSL/TLS → Overview**: set encryption mode to **Full (Strict)**.
2. **SSL/TLS → Edge Certificates**:
   - Always Use HTTPS: On
   - Automatic HTTPS Rewrites: On
   - Opportunistic Encryption: On
   - TLS 1.3: On
   - Minimum TLS Version: **1.2** (move to 1.3 once confident)
   - 0-RTT: On
   - HSTS: enable, `max-age = 12 months`, Include Subdomains, Preload, No-Sniff.
3. **Network**: HTTP/2: On, HTTP/3 (QUIC): On, 0-RTT: On, WebSockets: On.
4. **Security → Settings**:
   - Security Level: **High**
   - Challenge Passage: 30 minutes
   - Browser Integrity Check: On
   - Privacy Pass Support: On
5. **Security → Bots** → **Bot Fight Mode**: On.
6. **Scrape Shield**: Email Obfuscation, Hotlink Protection, Server-Side
   Excludes all On.
7. **DNS → Settings → DNSSEC**: click Enable, then paste the DS record into
   your registrar (webhostingireland.ie). Leave it until the registrar has
   published, then come back and confirm "Active".

### Alternative — let me do it from the API

If you'd rather I apply steps 1–6 via the API too, add these permissions to
the token or mint a new one and replace the value in `.env.local`:

- Zone → Zone Settings → Edit
- Zone → SSL and Certificates → Edit
- Zone → DNS → Edit  *(only if you also want DNSSEC toggled via API)*

Then just say "re-run with the wider token" and I'll do the rest.

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
