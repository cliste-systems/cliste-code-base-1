/**
 * Run Lighthouse audit for authenticated dashboard routes.
 *
 *   npx tsx scripts/perf/run-lighthouse.ts
 */
import { writeFileSync } from "node:fs";

import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import type { RunnerResult } from "lighthouse";
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
  roundScore,
  RUNS_PER_ROUTE,
  timestampSlug,
} from "./shared";

type LighthouseRouteResult = {
  path: string;
  label: string;
  mobile: {
    performanceScore: number;
    ttfbMs: number;
    lcpMs: number;
    tbtMs: number;
    transferKb: number;
    flagged: boolean;
  };
};

function auditMetrics(result: RunnerResult) {
  const lhr = result.lhr;
  const audits = lhr.audits;
  const score = (lhr.categories.performance?.score ?? 0) * 100;
  const ttfb = audits["server-response-time"]?.numericValue ?? 0;
  const lcp = audits["largest-contentful-paint"]?.numericValue ?? 0;
  const tbt = audits["total-blocking-time"]?.numericValue ?? 0;
  const transfer =
    audits["total-byte-weight"]?.numericValue != null
      ? audits["total-byte-weight"].numericValue / 1024
      : 0;
  const flagged = ttfb > 600 || lcp > 2500 || score < 70 || transfer > 300;
  return {
    performanceScore: roundScore(score),
    ttfbMs: roundMs(ttfb),
    lcpMs: roundMs(lcp),
    tbtMs: roundMs(tbt),
    transferKb: roundScore(transfer),
    flagged,
  };
}

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

async function injectCookies(port: number): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
  const cookies = await context.cookies(DEFAULT_BASE_URL);
  await browser.close();

  const CDP = (await import("chrome-remote-interface")).default as (options: {
    port: number;
  }) => Promise<{
    Network: {
      enable: () => Promise<void>;
      setCookie: (cookie: Record<string, unknown>) => Promise<unknown>;
    };
    close: () => Promise<void>;
  }>;
  const client = await CDP({ port });
  const { Network } = client;
  await Network.enable();

  const origin = new URL(DEFAULT_BASE_URL).origin;
  for (const cookie of cookies) {
    await Network.setCookie({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain.replace(/^\./, ""),
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite:
        cookie.sameSite === "None"
          ? "None"
          : cookie.sameSite === "Strict"
            ? "Strict"
            : "Lax",
      url: origin,
    });
  }
  await client.close();
}

async function runLighthouseAudit(url: string): Promise<RunnerResult> {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
  });

  try {
    await injectCookies(chrome.port);
    const result = await lighthouse(url, {
      logLevel: "error",
      output: "json",
      port: chrome.port,
      onlyCategories: ["performance"],
      formFactor: "mobile",
      screenEmulation: {
        mobile: true,
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
        disabled: false,
      },
    });
    if (!result) {
      throw new Error(`Lighthouse returned no result for ${url}`);
    }
    return result;
  } finally {
    await chrome.kill();
  }
}

async function main(): Promise<void> {
  ensurePerfDirs();
  loadCredentials();
  await ensureAuthState();

  const results: LighthouseRouteResult[] = [];

  for (const route of DASHBOARD_PERF_ROUTES) {
    const url = `${DEFAULT_BASE_URL}${route.path}`;
    const runMetrics = [];

    for (let i = 0; i < RUNS_PER_ROUTE; i++) {
      const result = await runLighthouseAudit(url);
      runMetrics.push(auditMetrics(result));
      console.log(
        `  ${route.label} run ${i + 1}/${RUNS_PER_ROUTE}: score=${runMetrics[i]!.performanceScore}`,
      );
    }

    const mobile = {
      performanceScore: roundScore(
        median(runMetrics.map((m) => m.performanceScore)),
      ),
      ttfbMs: roundMs(median(runMetrics.map((m) => m.ttfbMs))),
      lcpMs: roundMs(median(runMetrics.map((m) => m.lcpMs))),
      tbtMs: roundMs(median(runMetrics.map((m) => m.tbtMs))),
      transferKb: roundScore(median(runMetrics.map((m) => m.transferKb))),
      flagged: runMetrics.some((m) => m.flagged),
    };

    results.push({ path: route.path, label: route.label, mobile });
    console.log(
      `${route.label.padEnd(22)} score=${mobile.performanceScore} ttfb=${mobile.ttfbMs}ms lcp=${mobile.lcpMs}ms`,
    );
  }

  results.sort((a, b) => a.mobile.performanceScore - b.mobile.performanceScore);

  const slug = timestampSlug();
  const jsonPath = `${PERF_RESULTS_DIR}/lighthouse-${slug}.json`;
  writeFileSync(
    jsonPath,
    JSON.stringify({ baseUrl: DEFAULT_BASE_URL, results }, null, 2),
  );

  const mdLines = [
    `# Dashboard Lighthouse report (mobile)`,
    ``,
    `Base URL: ${DEFAULT_BASE_URL}`,
    `Runs per route: ${RUNS_PER_ROUTE}`,
    ``,
    `| Route | Score | TTFB | LCP | TBT | Transfer | Flag |`,
    `| --- | ---: | ---: | ---: | ---: | ---: | --- |`,
    ...results.map(
      (r) =>
        `| ${r.label} (\`${r.path}\`) | ${r.mobile.performanceScore} | ${r.mobile.ttfbMs}ms | ${r.mobile.lcpMs}ms | ${r.mobile.tbtMs}ms | ${r.mobile.transferKb}KB | ${r.mobile.flagged ? "⚠" : ""} |`,
    ),
  ];
  const mdPath = `${PERF_RESULTS_DIR}/lighthouse-${slug}.md`;
  writeFileSync(mdPath, mdLines.join("\n"));

  console.log(`\n✓ Wrote ${jsonPath}`);
  console.log(`✓ Wrote ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
