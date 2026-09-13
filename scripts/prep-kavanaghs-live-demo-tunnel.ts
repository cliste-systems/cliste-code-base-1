/**
 * Point Railway voice webhooks at your local dashboard for the Garreth demo.
 * Production app.hellocara.ie webhooks are unavailable while Vercel is suspended.
 *
 * Prerequisites:
 *   1. npm run dev -- -p 3001   (in another terminal)
 *   2. ngrok http 3001          (in another terminal)
 *
 * Then:
 *   npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --ngrok-url https://xxxx.ngrok-free.app
 *   npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --restore
 */

import { execSync } from "node:child_process";

const PRODUCTION_APP_URL = "https://app.hellocara.ie";
const RAILWAY_PROJECT = "cliste-code-base-2";
const RAILWAY_SERVICE = "cliste-code-base-2";

function parseNgrokUrl(): string | null {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ngrok-url" && args[i + 1]) {
      return args[++i]!.replace(/\/$/, "");
    }
  }
  return null;
}

function restore(): void {
  console.log(`Restoring Railway CLISTE_APP_URL → ${PRODUCTION_APP_URL}`);
  execSync(
    `railway variables --set "CLISTE_APP_URL=${PRODUCTION_APP_URL}" --service "${RAILWAY_SERVICE}"`,
    { stdio: "inherit", cwd: process.cwd() },
  );
  console.log("\n✓ Restored. Redeploy may take ~1 minute.");
}

function setTunnel(ngrokUrl: string): void {
  if (!/^https:\/\/.+/i.test(ngrokUrl)) {
    throw new Error("ngrok URL must start with https://");
  }
  console.log(`Setting Railway CLISTE_APP_URL → ${ngrokUrl}`);
  execSync(
    `railway variables --set "CLISTE_APP_URL=${ngrokUrl}" --service "${RAILWAY_SERVICE}"`,
    { stdio: "inherit", cwd: process.cwd() },
  );
  console.log("\n✓ Tunnel configured.");
  console.log("  Live calls to +353749759508 will POST webhooks to your local dashboard.");
  console.log("  Dashboard: http://localhost:3001/dashboard (kavanaghs@cliste.test)");
  console.log(`\n  After the demo: npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --restore`);
}

function main(): void {
  if (process.argv.includes("--restore")) {
    restore();
    return;
  }

  const ngrokUrl = parseNgrokUrl();
  if (!ngrokUrl) {
    console.log("Kavanaghs live demo — webhook tunnel setup\n");
    console.log("Production webhooks on app.hellocara.ie return 503 (Vercel suspended).");
    console.log("For live Action Inbox tickets during phone calls, tunnel webhooks locally:\n");
    console.log("  Terminal 1: cd cliste-code-base-1 && npm run dev -- -p 3001");
    console.log("  Terminal 2: ngrok http 3001");
    console.log(
      "  Terminal 3: npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --ngrok-url https://YOUR.ngrok-free.app\n",
    );
    console.log(`Railway project: ${RAILWAY_PROJECT} / service: ${RAILWAY_SERVICE}`);
    process.exit(0);
  }

  setTunnel(ngrokUrl);
}

main();
