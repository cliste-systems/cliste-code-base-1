# Retail pilot plan

Strategy for the Hello Cara retail launch. **Phase 1 (this PR) strips the store and admin surfaces.** Later phases (launch hardening, retail build-out, P1 hardening, scale) are sequenced in the master work order and are **not** started here.

Related: [VERTICALS.md](./VERTICALS.md).

## Goal

Cliste provisions each store from `/admin`. Store staff get a three-screen dashboard. Public self-serve signup stays in the repo but is gated off (`PUBLIC_SIGNUP_ENABLED`, default off). Do not delete [`src/app/(onboarding)/`](../src/app/(onboarding)/).

Judge product choices against **store #2**, not a one-off Donegal Town hack. One shared product for every store.

## Phase 1 — client dashboard (shipped)

Primary nav is **three items**:

| Nav | Route | Role |
|-----|-------|------|
| **Knowledge Gaps** | `/dashboard` | Default landing. Existing Cara training UI; badge = open `cara_training_items`. |
| **Calls** | `/dashboard/calls` | Hear what Cara said/did. Action Inbox is folded here (ticket/outcome on the call). |
| **Setup** | `/dashboard/setup` | Opening hours, departments (`store_departments`: hours, transfer, Off-licence, An Post), FAQs. |

Footer (not primary nav): Settings (notification email + phone only), Support, Legal.

Out of store nav: Files (`/dashboard/business/files` — Cliste uploads via impersonation), contacts, routing, usage/billing, team, locations, business/services, activity, `cara-setup/*`. Those URLs 308 via `dashboardStripRedirect`.

## Phase 1 — admin dashboard (shipped)

Five nav items: Overview · Phone pool · Identity & access · Security · Support tickets.

- Onboarding queue **page + nav** removed (`onboarding_applications` table kept).
- Booking value tile removed.
- “New retail client” always shown; `tier: "native"`; niche picker hidden (server still defaults `retail`).
- LiveKit US phone card hidden unless `ADMIN_SHOW_LIVEKIT_US_PHONE=1`. Irish DID card stays.

Do **not** rename Overview/Users to Stores yet (Phase 3.5). Store-health, client notes, and warm-transfer go/no-go live on the organization page (Phase 3).

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Billing | Manual invoicing. Suspended stores see “contact Cliste”, not a checkout. |
| Signup | Keep `/signup` + `/onboarding`, including salon parts. Gate with `PUBLIC_SIGNUP_ENABLED` (default off). |
| What stores can edit | Hours, departments (table), FAQs, notification email/phone. Routing, blocklist, plan, and files stay admin/Cliste-managed. |
| Vertical | Admin create hardcodes native + `organizations.niche = retail`. Retail is the only live pack. |

## Architecture

```
/admin  →  account + organization + email invite (status = active)
        →  Irish DID from Twilio pool
        →  forwarding mode / divert codes / transfer number
        →  manual plan
        →  magic-link into the tenant dashboard

/dashboard (retail)  →  Knowledge Gaps, Calls, Setup
                     →  footer: Settings, Support, Legal
                     →  Files reachable, not in nav
```

Admin-created accounts insert `accounts.status = 'active'` and skip the dashboard layout redirect to `/onboarding` (`pending_verification` / `onboarding` only).

## Later phases

2. Launch blockers — adapted onto the stripped tree in Phase 2.
3. Build retail (this PR) — `gap_kind`, departments table, hardware warm-transfer go/no-go, admin store health.
4. P1 hardening leftover after Phase 2.
5. Scale / backlog.

## Out of scope for Phase 1

- Self-serve billing / Stripe portal for retail
- Deleting `/signup` or salon onboarding
- Per-store custom dashboards
- Demo niches, fake filters, or “coming soon” controls
- Merging launch-hardening (PR #4) before this strip
