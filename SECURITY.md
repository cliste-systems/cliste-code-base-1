# Cliste — Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in any Cliste service
(`*.clistesystems.ie`, the dashboard, the booking storefront, the AI voice
agent worker, or our infrastructure), please report it privately to:

- **Email:** security@clistesystems.ie
- PGP key: available on request.

Please include enough detail for us to reproduce: a clear description, steps,
proof-of-concept where safe, and the affected URL / endpoint / commit. Don't
file a public GitHub issue.

We treat all reports seriously and will work with you to triage and fix
quickly. We will not pursue legal action against good-faith researchers who:

- Don't access, alter, or destroy customer data beyond what's strictly
  necessary to demonstrate the issue.
- Stop probing the moment they think they've reached PII (and tell us
  about it instead).
- Don't run automated scanners that disrupt service availability.
- Give us a reasonable window (we aim for a fix within 30 days for High /
  Critical, 90 days for Medium, before public disclosure).

## What's in scope

- Production hosts: `app.clistesystems.ie`, `book.clistesystems.ie`,
  `clistesystems.ie`, and any tenant subdomains we operate.
- The Cliste booking storefront, the dashboard, the admin console, the
  Stripe webhook (`/api/stripe/webhook`), the voice webhook
  (`/api/voice/call-complete`), and our cron endpoints.
- The AI voice agent (LiveKit worker) and its inbound SIP integration,
  insofar as the worker is operated by Cliste.

## Out of scope

- Findings that require physical access to a salon's reception device.
- Social engineering against Cliste employees or salon staff.
- Volumetric DDoS / DoS without a clear amplification primitive.
- Reports of best-practice / hardening suggestions with no concrete
  exploit path (we welcome them, but they're not eligible for any bounty
  treatment).
- Stripe / Twilio / Supabase / OpenAI / ElevenLabs / Deepgram / LiveKit /
  SendGrid / Cloudflare platform issues — please report those upstream.

## Acknowledgements

We're happy to credit researchers in our `THANKS.md` once a fix is shipped,
unless you prefer to remain anonymous.
