# Vertical packs

A **vertical** is the product-tailoring layer above organization **niches**. Today there are two verticals — `salon_beauty` (tailored) and `generic` (neutral fallback). Each vertical is defined by a single **pack object** in [`src/lib/verticals.ts`](../src/lib/verticals.ts).

Adding a new vertical should require **one pack object + config rows**, not new pages or components.

## How to add a vertical

Follow these steps in order:

1. **Add the id** to `VerticalId` in [`src/lib/verticals.ts`](../src/lib/verticals.ts).

2. **Map niche(s)** — add entries to the pack's `niches[]` array and `NICHE_TO_VERTICAL`. If the niche is new, add it to [`src/lib/organization-niche.ts`](../src/lib/organization-niche.ts) first.

3. **Author the pack** — set `capabilities`, `locationNoun`, `nav` (optional diffs), `onboarding`, and `selection` copy on the pack object. Register it in `VERTICAL_PACKS`.

4. **Author dashboard copy** — create `<NAME>_COPY` in [`src/lib/dashboard-vertical-copy.ts`](../src/lib/dashboard-vertical-copy.ts) and register it in `VERTICAL_COPY`. TypeScript `Record<VerticalId, …>` completeness will flag anything missing.

5. **Register onboarding copy** — add entries to train-cara vertical copy registries (`train-cara-vertical-copy.ts`, capture fields, FAQ suggestions, services copy as needed).

6. **Nav diffs** (optional) — use `pack.nav.labelOverrides`, `hiddenHrefs`, or `extraItems`. New hrefs need a destination page and an entry in `NAV_ICONS` in [`dashboard-sidebar.tsx`](../src/app/(dashboard)/dashboard/dashboard-sidebar.tsx) (fallback icon is `LayoutDashboard`).

7. **Add to `VERTICAL_CHOICES`** only when copy is real — no placeholder picker entries.

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
