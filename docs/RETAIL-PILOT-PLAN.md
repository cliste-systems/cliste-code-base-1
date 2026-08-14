# Retail pilot plan

Strategy and build plan for the Hello Cara retail launch, starting with **Kavanaghs SuperValu, Donegal Town**, then other SuperValu stores (e.g. Dungloe) on one shared multi-tenant dashboard.

This document is the durable copy of the Cursor plan `retail_pivot_plan_22e41a1d` plus what we found in the GitHub tree and in **live production** on 2026-08-14.

Related: [VERTICALS.md](./VERTICALS.md), [ops/LAUNCH-HARDENING-PROMPT.md](./ops/LAUNCH-HARDENING-PROMPT.md), [ops/PRODUCTION-CHECKLIST.md](./ops/PRODUCTION-CHECKLIST.md).

## Goal

Cliste provisions each store from `/admin`. Store staff get a small client dashboard (calls, follow-ups, hours, FAQs). Cara training, call flow, and billing stay with Cliste. Public self-serve signup stays in the repo but is gated off.

One shared product for every store. New features ship to every tenant.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Billing | **Manual invoicing.** Strip self-serve Stripe from the retail client dashboard. Admin sets the plan. Suspended stores see “contact Cliste”, not a checkout. |
| Signup | **Keep the full `/signup` + `/onboarding` flow, including salon parts.** Gate it with `PUBLIC_SIGNUP_ENABLED` (default off). Do not delete it. |
| What stores can edit | **Opening hours + FAQs** (Store info). Cara training, routing, and plan stay admin-managed. Settings that are already wired (notification contacts, forwarding mode) may stay — they are useful on the shop floor. |
| Vertical | Admin “New retail client” defaults `organizations.niche` to `retail`. One dashboard for all SuperValu locations under an account. |

## Architecture

```
/admin  →  account + organization + email invite
        →  Irish DID from Twilio pool
        →  forwarding mode / divert codes / transfer number
        →  manual plan
        →  magic-link into the tenant dashboard

/dashboard (retail)  →  Home, Calls, Action Inbox, Contacts,
                        Store info (hours / location / FAQs),
                        Team, Settings, Support, Legal
                     →  hide Call flow, Cara Training, Usage/billing
                     →  Locations only when the account has 2+ stores
```

Knowledge isolation is **per organization** (compiled into `organizations.custom_prompt`). Voice tenancy is **called number → `phone_numbers`**, not a body `organization_id`. See the uncle-Joe write-up from the launch-hardening thread: RLS on `organization_id` / `account_id`, service role for admin/webhooks.

## Build plan (original eight items)

1. First-class `retail` vertical pack (noun “Store” / “customers”; supermarket routing: opening hours, stock, click & collect, weekly offers, department transfer). Default for every admin-created client.
2. Delete retired non-signup salon surfaces that exist on **this** GitHub tree (storefront `/[salonSlug]`, pay-link `/p/[ref]`, booking-disabled notice). Do not delete `/signup`.
3. Gate `/signup` and signed-out `/onboarding` behind `PUBLIC_SIGNUP_ENABLED` (default off). Hide “Create account”.
4. Admin “New retail client” wizard: account + org + email invite.
5. Admin org page: assign Irish DID from the Twilio pool, forwarding mode + divert codes, transfer number, manual plan, magic-link into the tenant dashboard.
6. Trim the client dashboard to the retail-minimal surface listed above.
7. Hide Call flow, Cara Training, Stripe/billing; suspended stores get “contact Cliste”. Locations nav only if 2+ stores.
8. Retail copy pass (Customers, Deli, Butcher, Click & collect, and so on).

## What shipped on `main`

These commits landed and are in production deploys of `main`:

| Commit | What |
|--------|------|
| `ce2f3e8` | Added `retail` to `VerticalId`, `RETAIL_PACK` (productNoun “Store”), deleted retired storefront/pay-link routes. |
| `98bcd35` | `PUBLIC_SIGNUP_ENABLED` gate; admin provisioning (routing card, Irish DID, manual plan, open-dashboard). |
| `1aea3c6` | Retail-minimal nav (`RETAIL_HIDDEN_NAV_HREFS`); Usage/billing stripped for `niche === "retail"`; locations copy for stores. |

`src/lib/public-signup.ts` still freezes self-serve signup. Admin `createOrganization` still defaults `niche` to `"retail"`. `/dashboard/billing` still redirects retail orgs away from Stripe.

## Live production findings (2026-08-14)

Queried project `rtoebbwzwxcnscsxghww` (`cliste-systems-salon`, `eu-central-1`, Postgres 17, `ACTIVE_HEALTHY`).

### Tenants

There is **no SuperValu / Kavanaghs / retail row**. Production is still the salon sandbox:

| Organization | Slug | Niche | Active | Account status |
|--------------|------|-------|--------|----------------|
| BRENDANS SALON | `brendans-salon` | `other` | no | `onboarding` / `not_started` |
| BRENDANS SALON | `brendans-salon-v011` | `hair_salon` | yes | `active` / `completed` |
| BRENDANS SALON | `brendans-salon-1jpd` | `beauty` | yes | `active` / `completed` |

Phone pool: two assigned Irish DIDs (`+353749389378` on v011, `+35315551947707` on 1jpd) and two `available` numbers. Niche check constraint **does** include `'retail'` (`051_widen_organization_niche.sql`); we simply have not inserted a retail org yet.

### Hello Cara merge dropped the retail pack

`git diff ce2f3e8 HEAD -- src/lib/verticals.ts` shows the current tree **lost** `VerticalId = "… | "retail"` and `RETAIL_PACK`. `verticalPackForNiche("retail")` now returns **generic**.

That merge (`186cd7e` / `1e655e7` Hello Cara rebrand) rewrote `verticals.ts` from a lineage that never had the pack. Consequences on `main` today:

- Dashboard nav is **not** trimmed for retail. `layout.tsx` calls `navItemsForVertical(navItems, vertical)`, but the generic pack has no `hiddenHrefs`. Call flow, Training, and Usage show for a `niche=retail` org.
- `docs/VERTICALS.md` still says the only tailored vertical is `salon_beauty`.
- `dashboard-vertical-copy.ts` `VERTICAL_COPY` has no `retail` key (only a routing override under `ROUTING_OVERRIDES_BY_NICHE.retail`).
- Billing/locations still special-case `parseOrganizationNiche(...) === "retail"` in the page, so those two surfaces work even without the pack. The rest of the “minimal store dashboard” does not.

Restore the pack on the **current** `VerticalPack` shape (capabilities, `nav.hiddenHrefs`, `locationNoun`, `packVersion`) — do not replay the pre-rebrand pack object from `ce2f3e8` verbatim.

Suggested nav hide list (from `1aea3c6`, mapped to current routes):

- `DASHBOARD_ROUTES.routing` (Call flow)
- `DASHBOARD_ROUTES.caraTraining` (Training)
- `DASHBOARD_ROUTES.usage` (Usage / billing)
- `DASHBOARD_ROUTES.locations` when the account has fewer than two stores
- Relabel business profile to **Store info** (`DASHBOARD_ROUTES.businessProfile` now; `caraSetup` is a legacy alias)

### Schema that already supports the pilot

No new retail tables are required. Production already has:

- `organizations.niche` including `retail`
- `organizations.agent_faqs` (jsonb, not null) for store FAQs
- `organizations.call_routing_mode`, `custom_prompt`, `plan_tier`
- `phone_numbers` pool + one-assigned-per-org unique index
- `accounts` + `account_memberships` for multi-location
- Launch-hardening: `auth_rate_limit_counters`, nullable `stripe_webhook_events.processed_at`, `auth_user_id_by_email`

Follow-up applied from this plan: `20260814140000` makes `security_auth_events` truly service-role-only for JWT roles (live grants still allowed `UPDATE`/`TRUNCATE` after the DELETE revoke).

### Auth / domains

After `scripts/patch-supabase-auth-urls.ts`: Auth `site_url` is `https://app.hellocara.ie`. Redirect allow-list still includes `app.clistesystems.ie` and localhost. Marketing `hellocara.ie` loads. `app.hellocara.ie` 307s to `/authenticate`. Launch-hardening origin gate is **not** on this traffic yet.

## Next build steps (in order)

1. **Restore `retail` as a first-class vertical pack** on the current `VerticalPack` type, with `hiddenHrefs` for call flow / training / usage, Store-info label, and `VERTICAL_COPY.retail`. Update [VERTICALS.md](./VERTICALS.md).
2. **Provision the Donegal Town store** from `/admin` (niche `retail`, Irish DID from the pool, forwarding + transfer, manual plan, invite). Mark the row so it is obvious in SQL (store name, not another “BRENDANS SALON”).
3. Land launch-hardening PR #4 (origin gate, env validation, impersonation audit) **before** the store goes live on a public number.
4. Copy pass: customers / departments / click & collect on Home, Action Inbox, and Cara greeting — only copy that is wired.
5. P2 from [LAUNCH-HARDENING-PROMPT.md](./ops/LAUNCH-HARDENING-PROMPT.md) after the first live week.

## Out of scope for the pilot

- Self-serve billing / Stripe portal for retail
- Deleting `/signup` or salon onboarding
- Per-store custom dashboards
- Demo niches, fake filters, or “coming soon” controls
