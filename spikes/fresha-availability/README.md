# Fresha public-booking availability spike

Standalone proof-of-concept for reading live appointment slots from a salon's **public** Fresha booking page. Fresha has no documented public booking API; their SPA loads availability via internal GraphQL after the page opens. Cloudflare blocks plain HTTP clients — we use a **headed** Playwright browser.

This folder is intentionally isolated — nothing here is imported by the Cliste app or voice worker.

## Setup

```bash
cd spikes/fresha-availability
npm i
npx playwright install chromium
```

## Quick check (recommended) — `check-slots.mjs`

One-shot script with all UI lessons baked in (cookie banner, service-row Book button, horizontal date strip `Tue 23 Jun`, GraphQL slot parsing):

```bash
node check-slots.mjs --service="Mini Manicure" --date=2026-06-23
node check-slots.mjs --service="Mini Manicure" --date=2026-06-23 --at=10:55
node check-slots.mjs --url="https://www.fresha.com/a/..." --service="Mini Manicure" --date=2026-06-23
```

Prints slot count + times, saves `captured/check-<date>.json` and a screenshot. Exit code `0` = slots found, `1` = fully booked or flow failed.

**Tell the agent what to test** with natural language, e.g.:

> Check Mini Manicure on Tuesday 23 June at the Sligo salon — is 10:55 free?

The agent should run `check-slots.mjs` with matching `--service`, `--date`, and optional `--at`.

## Network discovery — `sniff.mjs`

Longer capture window for endpoint discovery (uses the same booking flow helpers):

```bash
node sniff.mjs --service="Mini Manicure" --date=2026-06-23 --minutes=5
```

Writes individual JSON files per network call and prints **MOST LIKELY AVAILABILITY ENDPOINT(S)** on exit.

## Replay captured data — `replay.mjs`

```bash
node replay.mjs --from=captured/check-2026-06-23.json --at=10:55
```

Uses `lib/fresha-slots.mjs` → `normalizeToShadowSlots()` with confirmed field paths:

- Slots live at `data.bookingFlowActionButtonPressed.screenTime.day.timeslots[]`
- Each slot: `{ time: "10:55 AM", action.id: '[{"type":"onScreenTimeSet","date":"2026-06-23","time":39300},...]' }`
- `time` in action JSON = seconds from local midnight

## Shared modules

| File | Purpose |
|------|---------|
| `lib/fresha-flow.mjs` | Playwright booking flow (banner dismiss, service Book, date strip) |
| `lib/fresha-slots.mjs` | Parse GraphQL → shadow-calendar slots |

## What we learned (Jun 2026, Sligo test salon)

1. **Dismiss cookie banner first** — otherwise Book clicks are intercepted.
2. **Click Book on the service row**, not the sidebar "Book now".
3. **Date picker is horizontal** — match `Tue 23 Jun`, not calendar grid `23`.
4. **Availability is GraphQL** — `bookingFlowActionButtonPressed` mutation responses contain `timeslots[]`.

## Safety

- Single browser session; no polling loops.
- `captured/` is gitignored (may contain salon/PII data).
- Never commit or log cookies, auth headers, or tokens.

## Next step

Wire `normalizeToShadowSlots` from `lib/fresha-slots.mjs` into production `availability_cache`.
