/**
 * Sign in via Playwright and persist storage state for perf audits.
 *
 *   npx tsx scripts/perf/auth-dashboard.ts
 */
import { existsSync, writeFileSync } from "node:fs";

import { chromium } from "playwright";

import {
  AUTH_STATE_PATH,
  DEFAULT_BASE_URL,
  ensurePerfDirs,
  loadCredentials,
} from "./shared";

async function main(): Promise<void> {
  ensurePerfDirs();
  const { email, password } = loadCredentials();
  const baseUrl = DEFAULT_BASE_URL;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseUrl}/authenticate`, { waitUntil: "domcontentloaded" });
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/dashboard") ||
      url.pathname === "/auth/post-login",
    { timeout: 60_000 },
  );

  if (page.url().includes("/auth/post-login")) {
    await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), {
      timeout: 60_000,
    });
  }

  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();

  if (!existsSync(AUTH_STATE_PATH)) {
    throw new Error("Failed to write Playwright auth state.");
  }

  console.log(`✓ Auth state saved to ${AUTH_STATE_PATH}`);
  console.log(`  Signed in as ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
