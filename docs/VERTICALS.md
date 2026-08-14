# Vertical packs

A **vertical** is the product-tailoring layer above organization **niches**. Packs live in [`src/lib/verticals.ts`](../src/lib/verticals.ts). **Retail is the only live pack** (`VERTICAL_CHOICES`). `salon_beauty` and `generic` stay in the machinery (frozen onboarding copy, classifier fallbacks) but are not offered as choices.

Adding a new vertical should require **one pack object + config rows**, not new pages or components. Do not collapse `VerticalId` to a single enum.

## Live store dashboard (Phase 1)

Primary nav is three items for every store session:

| Nav | Route | Role |
|-----|-------|------|
| **Knowledge Gaps** | `/dashboard` | Default landing. Badge = open `cara_training_items`. |
| **Calls** | `/dashboard/calls` | Hear what Cara said/did; follow-ups stay on the call (Action Inbox is folded here). |
| **Setup** | `/dashboard/setup` | Opening hours, department chips, FAQs. |

Settings, Support, and Legal live in the footer — not primary nav. Files stay reachable at `/dashboard/business/files` for Cliste impersonation; they are not in store nav.

## How to add a vertical

Follow these steps in order:

1. **Add the id** to `VerticalId` in [`src/lib/verticals.ts`](../src/lib/verticals.ts).

2. **Map niche(s)** — add entries to the pack's `niches[]` array and `NICHE_TO_VERTICAL`. If the niche is new, add it to [`src/lib/organization-niche.ts`](../src/lib/organization-niche.ts) first.

3. **Author the pack** — set `capabilities`, `locationNoun`, `nav` (optional diffs), `onboarding`, and `selection` copy on the pack object. Register it in `VERTICAL_PACKS`.

4. **Author dashboard copy** — create `<NAME>_COPY` in [`src/lib/dashboard-vertical-copy.ts`](../src/lib/dashboard-vertical-copy.ts) and register it in `VERTICAL_COPY`. TypeScript `Record<VerticalId, …>` completeness will flag anything missing.

5. **Register onboarding copy** — add entries to train-cara vertical copy registries (`train-cara-vertical-copy.ts`, capture fields, FAQ suggestions, services copy as needed).

6. **Nav diffs** (optional) — use `pack.nav.labelOverrides`, `hiddenHrefs`, or `extraItems`. New hrefs need a destination page and an entry in `NAV_ICONS` in [`dashboard-sidebar.tsx`](../src/app/(dashboard)/dashboard/dashboard-sidebar.tsx) (fallback icon is `LayoutDashboard`).

7. **Add to `VERTICAL_CHOICES`** only when the pack is live — no placeholder picker entries. Salon is intentionally omitted.

8. **Run verification** — `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. The guardrail test in [`src/lib/vertical-fork-guardrail.test.ts`](../src/lib/vertical-fork-guardrail.test.ts) must pass.

## Capability flags

Behaviour differences (service catalog, service area, booking routes, go-live checklist) live on `VerticalPack.capabilities`. Shared UI and server actions read flags via `verticalPackForNiche(niche)` — never `=== "salon_beauty"` outside config files.

## Copy registries

String differences (labels, placeholders, hero text, FAQ templates) live in vertical-keyed copy registries (`VERTICAL_COPY`, train-cara copy modules). Content forks stay in registries; do not collapse them to boolean flags.

## Routing overrides

Niche-specific routing examples for generic-vertical orgs merge from `ROUTING_OVERRIDES_BY_NICHE` in `dashboard-vertical-copy.ts` onto the vertical base copy. Salon niches use `SALON_COPY.routing` directly.

## What this does not cover

- **New pages** for a vertical still require real page work.
- **Declarative per-service field controls** (e.g. a patch-test toggle) are a separate follow-up — not part of the pack layer.
- **Phase 3 departments table** (hours, transfer, off-licence) — Setup currently reuses existing department chips, not a new table.
