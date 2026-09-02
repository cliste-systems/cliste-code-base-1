/**
 * Smoke-test perf harness wiring without a live server.
 *
 *   npx tsx scripts/perf/validate-harness.ts
 */
import { DASHBOARD_PERF_ROUTES } from "./routes-dashboard";
import { median, roundMs } from "./shared";

if (DASHBOARD_PERF_ROUTES.length < 18) {
  throw new Error(`Expected at least 18 dashboard routes, got ${DASHBOARD_PERF_ROUTES.length}`);
}

const paths = new Set(DASHBOARD_PERF_ROUTES.map((route) => route.path));
if (paths.size !== DASHBOARD_PERF_ROUTES.length) {
  throw new Error("Duplicate paths in DASHBOARD_PERF_ROUTES");
}

if (median([100, 200, 300]) !== 200) {
  throw new Error("median helper failed");
}

if (roundMs(12.6) !== 13) {
  throw new Error("roundMs helper failed");
}

console.log(`✓ Perf harness OK (${DASHBOARD_PERF_ROUTES.length} routes)`);
