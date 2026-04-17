# Cloudflare hardening playbook

This file tells you **exactly what to turn on in the Cloudflare dashboard**
(and optionally via the API) to lock down the Cliste production zones. It is
tuned for the current stack:

- `cliste-code-base-1` → Vercel (Next.js) behind Cloudflare DNS.
- `cliste-code-base-2` → Railway (LiveKit voice agent) behind Cloudflare DNS
  for any inbound HTTPS it exposes (telephony SIP goes via Twilio direct — not
  Cloudflare's job).

Before you start:

1. **Rotate any API token you have ever pasted into chat, a ticket, Slack, or
   email.** Pasted tokens must be considered compromised immediately — go to
   <https://dash.cloudflare.com/profile/api-tokens> and roll.
2. When you mint a replacement, **scope it tightly**:
   - Zone → your zone(s) only. Not "All zones".
   - Permissions: `Zone:Read`, `Zone Settings:Edit`, `DNS:Edit`,
     `Firewall Services:Edit`, `Page Rules:Edit`, `Workers Scripts:Edit`,
     `Workers Routes:Edit`, `Cache Rules:Edit`.
   - Set an expiry (6–12 months), client-IP filter if possible.
3. Store the token in a local shell env (`CLOUDFLARE_API_TOKEN=…`) or a
   password manager — never in chat, a git repo, or a shared doc.

---

## 1. DNS & transport

| Setting | Value | Where |
|---|---|---|
| DNS records for `cliste…` hosts | Proxied (orange cloud) | DNS tab |
| DNSSEC | **Enable** and copy the DS record to your registrar | DNS → Settings |
| Always Use HTTPS | On | SSL/TLS → Edge Certificates |
| Automatic HTTPS Rewrites | On | SSL/TLS → Edge Certificates |
| SSL/TLS encryption mode | **Full (Strict)** | SSL/TLS → Overview |
| Minimum TLS Version | **TLS 1.3** (fall back to 1.2 only if a partner breaks) | SSL/TLS → Edge Certificates |
| TLS 1.3 | On | same page |
| Opportunistic Encryption | On | same page |
| HTTP/2, HTTP/3 (QUIC) | On | Network tab |
| HSTS | Enabled, `max-age=63072000`, includeSubDomains, preload | SSL/TLS → Edge Certificates → HSTS |

Note: HSTS preload is also asserted by the app (`next.config.ts`). Once you've
confirmed prod traffic works for 2 weeks, you can submit your apex domain to
<https://hstspreload.org/>.

---

## 2. Bot & abuse controls

| Setting | Value | Notes |
|---|---|---|
| Bot Fight Mode | On (free plan) or **Super Bot Fight Mode** (Pro) | Security → Bots |
| Browser Integrity Check | On | Security → Settings |
| Challenge Passage | 30 min | same page |
| Privacy Pass support | On | same page |
| Hotlink Protection | On | Scrape Shield |
| Email Obfuscation | On | Scrape Shield |
| Security Level | **High** (or **I'm Under Attack** if actively being DDoS'd) | Security → Settings |

---

## 3. WAF rules (Security → WAF → Custom rules)

Create these in order. `cliste.example` = your real zone.

### 3.1 Block known bad clients

```
(cf.client.bot) and not (cf.verified_bot_category in {"Search Engine Crawler" "Search Engine Optimization" "Monitoring & Analytics"})
→ Managed Challenge
```

### 3.2 Rate-limit authentication / unlock endpoints

Security → WAF → **Rate limiting rules**:

| Rule | Path | Rate | Action |
|---|---|---|---|
| `unlock-brute-force` | `http.request.uri.path in {"/admin-unlock" "/dashboard-unlock"}` and `http.request.method eq "POST"` | 5 per 5 min per IP | Block 30 min |
| `auth-brute-force`   | `starts_with(http.request.uri.path, "/authenticate")` and `http.request.method eq "POST"` | 10 per 5 min per IP | Managed Challenge |
| `api-booking-flood`  | `starts_with(http.request.uri.path, "/api/")` | 60 per minute per IP | Block 10 min |

These duplicate the in-app rate limits — that's intentional: Cloudflare is free
and runs at the edge, the in-app limits are the ground truth.

### 3.3 Geo-fence the admin surface

If you only operate from Ireland (and very occasional travel):

```
(http.request.uri.path contains "/admin" or http.request.uri.path contains "/dashboard")
and not (ip.geoip.country in {"IE" "GB"})
→ Managed Challenge
```

Use **Managed Challenge** (not Block) so your phone on a foreign SIM isn't
bricked. Swap to `Block` once you're confident.

### 3.4 Lock the Stripe webhook to Stripe's IPs

Stripe publishes the webhook source IP list at
<https://stripe.com/docs/ips#webhook-notifications>. Copy the current list into
a **Cloudflare IP List** (Account → Configurations → Lists), call it
`stripe_webhook_ips`, then:

```
(http.request.uri.path eq "/api/stripe/webhook") and not (ip.src in $stripe_webhook_ips)
→ Block
```

Revisit the list every quarter. The HMAC signature check in the webhook itself
still runs — this is belt-and-braces.

### 3.5 Hide the cron endpoint from the internet

`/api/cron/*` should only be called by your scheduler (Vercel Cron / Railway
cron). If you know its egress IPs, allowlist them. Otherwise:

```
(starts_with(http.request.uri.path, "/api/cron/")) and not (http.request.headers["x-cron-secret"][0] ne "")
→ Block
```

This blocks anyone hitting it without the header at all. The app also requires
a constant-time match of the secret value, so this is cheap defence in depth.

### 3.6 Deny request methods the app never uses

```
not (http.request.method in {"GET" "POST" "HEAD" "OPTIONS" "PUT" "PATCH" "DELETE"})
→ Block
```

Blocks legacy method-based probes (`PROPFIND`, `TRACE`, etc.).

---

## 4. Cache & page rules

The app already sends `Cache-Control: no-store` on the Stripe webhook. Add a
cache rule so nothing on `/api/*` gets cached, ever:

```
(starts_with(http.request.uri.path, "/api/"))
→ Cache eligibility: Bypass cache
```

---

## 5. Authenticated Origin Pulls (mTLS from CF → origin)

Prevents anyone who guesses your Vercel/Railway origin host from bypassing
Cloudflare entirely.

- Vercel: **not supported** on hobby/team tiers — skip there. Instead, set a
  custom `x-cf-shared-secret` header at Cloudflare (Transform Rules → Modify
  Request Header) and have Next.js middleware reject requests without it in
  production. The direct `*.vercel.app` URL should redirect to the canonical
  host anyway.
- Railway: set `x-cf-shared-secret` the same way and check it in `agent.ts` /
  any inbound HTTP handler.

Transform rule example:

```
when: any request
action: Set static → Header name: x-cf-shared-secret, value: <long random>
```

Then in code:

```ts
if (req.headers.get("x-cf-shared-secret") !== process.env.CF_SHARED_SECRET) {
  return new Response("forbidden", { status: 403 });
}
```

---

## 6. Zero Trust (optional, strongest gate)

If you want real 2FA on `/admin` and `/dashboard` instead of a shared
password:

1. Cloudflare Zero Trust → Access → Applications → **Add application** →
   Self-hosted.
2. App domain: `app.cliste.example` path `/admin` (one app) and `/dashboard`
   (second app).
3. Policy: **Emails ending in** `@clistesystems.ie` (or an explicit list),
   identity provider = One-time PIN or Google Workspace.
4. Session 8 hours, require purpose justification.

This replaces the `CLISTE_ADMIN_SECRET` / `CLISTE_DASHBOARD_GATE_SECRET` cookie
gate with a proper SSO flow. Keep the in-app gate as a second factor for now.

---

## 7. Email & DNS hygiene

In the zone DNS tab, make sure you have:

| Record | Purpose |
|---|---|
| `TXT _dmarc` with `v=DMARC1; p=reject; rua=mailto:dmarc@…` | Stop spoofed outbound email |
| `TXT @` with SPF, e.g. `v=spf1 include:sendgrid.net include:_spf.twilio.com ~all` | Only your senders can send as you |
| DKIM CNAMEs from SendGrid & Twilio | Signed mail |
| `TXT @` with `v=spf1 -all` on any domain you don't send from | Null SPF |
| MTA-STS + TLS-RPT | Enforce TLS on inbound mail |

Cloudflare Email Routing can handle catch-all + alias forwarding if you want;
it's free and saves running a real MX.

---

## 8. Secrets & audit log

- Account → Audit log: review weekly for 2 months, then monthly.
- Members: enforce **Hardware key 2FA** on all users. Remove any member who
  doesn't need access.
- Any API token you aren't actively using → **Delete**, don't just expire.

---

## 9. Driving it from code (optional)

If you'd rather I apply most of these with your **new** token, export it in
your local shell (never paste it in chat):

```bash
# ~/.zshrc or a local .env.local that's gitignored
export CLOUDFLARE_API_TOKEN='<fresh token you just minted>'
export CLOUDFLARE_ACCOUNT_ID='<your account id>'
export CLOUDFLARE_ZONE_ID='<zone id for your root domain>'
```

Then tell me, and I'll apply sections 1–4 via the Cloudflare REST API. The
code never prints the token back. You still have to do sections 5–7 by hand
because they require account-level settings or DNS coordination I can't safely
guess at.

---

## 10. Verification

After applying, verify from outside Cloudflare:

```bash
curl -I https://<your host>/                         # expect HSTS, CSP, Referrer-Policy
curl -I https://<your host>/robots.txt               # expect 200 with disallow list
curl -I -X POST https://<your host>/dashboard-unlock # rate-limit from 6th hit
curl https://<your host>/api/stripe/webhook           # expect 400 without Stripe sig
```

Also run <https://securityheaders.com/?q=your-host> — should be A+.
And <https://www.ssllabs.com/ssltest/> — should be A+.
