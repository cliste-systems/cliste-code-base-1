# Dashboard performance audit

Repeatable Lighthouse + TTFB audits for authenticated dashboard routes.

## Prerequisites

1. `.env.local` with dev Supabase keys (see `docs/ops/ENV.md`)
2. `npm run perf:seed` — writes `.perf/credentials.json`
3. `npm run build && npm run start` — production server on port 3001
4. Apply migration `083_dashboard_perf_indexes.sql` (RPC + indexes)

## Commands

```bash
npm run perf:validate  # smoke-test harness wiring (no server)
npm run perf:auth      # refresh Playwright auth state
npm run perf:ttfb      # document TTFB per route (fast)
npm run perf:audit     # Lighthouse mobile scores (slow)
npm run analyze        # bundle analyzer (ANALYZE=true next build)
```

Reports are written to `perf-results/` (gitignored) as timestamped JSON and Markdown.

## Interpreting flags

| Signal | Threshold |
| --- | --- |
| TTFB | > 600ms |
| LCP (mobile) | > 2.5s |
| Lighthouse performance | < 70 |
| Transfer size | > 300KB |

Sort order in reports is worst-first to prioritize fixes.

## SQL verification

After applying the migration, run `explain-dashboard-queries.sql` in the Supabase SQL editor (replace `:org_id`).
