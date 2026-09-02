/**
 * Measure document TTFB for dashboard routes using authenticated fetch.
 *
 *   npx tsx scripts/perf/run-server-timing.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { DASHBOARD_PERF_ROUTES } from "./routes-dashboard";
import {
  AUTH_STATE_PATH,
  DEFAULT_BASE_URL,
  ensurePerfDirs,
  loadCredentials,
  median,
  PERF_RESULTS_DIR,
  roundMs,
  RUNS_PER_ROUTE,
  timestampSlug,
} from "./shared";

type RouteTtfbResult = {
  path: string;
  label: string;
  runs: number[];
  medianMs: number;
  flagged: boolean;
};

async function ensureAuthState(): Promise<void> {
  const { execSync } = await import("node:child_process");
  const { existsSync } = await import("node:fs");
  if (!existsSync(AUTH_STATE_PATH)) {
    execSync("npx tsx scripts/perf/auth-dashboard.ts", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  }
}

async function getCookieHeader(): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
  const cookies = await context.cookies(DEFAULT_BASE_URL);
  await browser.close();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function measureTtfb(path: string, cookieHeader: string): Promise<number> {
  const start = performance.now();
  const response = await fetch(`${DEFAULT_BASE_URL}${path}`, {
    headers: { cookie: cookieHeader },
    redirect: "follow",
  });
  await response.text();
  const end = performance.now();
  if (!response.ok && response.status !== 304) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  return end - start;
}

async function main(): Promise<void> {
  ensurePerfDirs();
  loadCredentials();
  await ensureAuthState();
  const cookieHeader = await getCookieHeader();

  const results: RouteTtfbResult[] = [];

  for (const route of DASHBOARD_PERF_ROUTES) {
    const runs: number[] = [];
    for (let i = 0; i < RUNS_PER_ROUTE; i++) {
      runs.push(await measureTtfb(route.path, cookieHeader));
    }
    const medianMs = median(runs);
    results.push({
      path: route.path,
      label: route.label,
      runs: runs.map(roundMs),
      medianMs: roundMs(medianMs),
      flagged: medianMs > 600,
    });
    console.log(`${route.label.padEnd(22)} ${roundMs(medianMs)}ms`);
  }

  results.sort((a, b) => b.medianMs - a.medianMs);

  const slug = timestampSlug();
  const jsonPath = join(PERF_RESULTS_DIR, `ttfb-${slug}.json`);
  writeFileSync(jsonPath, JSON.stringify({ baseUrl: DEFAULT_BASE_URL, results }, null, 2));

  const mdLines = [
    `# Dashboard TTFB report`,
    ``,
    `Base URL: ${DEFAULT_BASE_URL}`,
    `Runs per route: ${RUNS_PER_ROUTE}`,
    ``,
    `| Route | Median TTFB | Flag (>600ms) |`,
    `| --- | ---: | --- |`,
    ...results.map(
      (r) => `| ${r.label} (\`${r.path}\`) | ${r.medianMs}ms | ${r.flagged ? "⚠" : ""} |`,
    ),
  ];
  const mdPath = join(PERF_RESULTS_DIR, `ttfb-${slug}.md`);
  writeFileSync(mdPath, mdLines.join("\n"));

  console.log(`\n✓ Wrote ${jsonPath}`);
  console.log(`✓ Wrote ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
