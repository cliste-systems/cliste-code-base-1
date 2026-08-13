/**
 * Reconnect local dev + hosted auth to the Supabase project after unpause.
 *
 * Requires Supabase personal access token (`supabase login` or SUPABASE_ACCESS_TOKEN).
 *
 * Run:
 *   npx tsx scripts/reconnect-supabase.ts
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT_REF = "rtoebbwzwxcnscsxghww";
const ENV_LOCAL = join(process.cwd(), ".env.local");

function parseEnv(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

async function assertProjectReachable(): Promise<void> {
  const url = `https://${PROJECT_REF}.supabase.co/auth/v1/health`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = await response.text();
  if (response.status === 404 || body.toLowerCase().includes("project not found")) {
    throw new Error(
      `Supabase project ${PROJECT_REF} is not reachable. Confirm it is unpaused in the dashboard.`,
    );
  }
  console.log(`✓ Project host is online (${PROJECT_REF}.supabase.co)`);
}

async function smokeTestPublicApi(url: string, anonKey: string): Promise<void> {
  const response = await fetch(`${url}/rest/v1/organizations?select=id&limit=1`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Supabase REST smoke test failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }
  console.log("✓ REST API accepts anon key (organizations reachable)");
}

function runScript(script: string): void {
  const result = spawnSync("npx", ["tsx", script], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  await assertProjectReachable();

  console.log("\n→ Writing .env.local from Supabase Management API…");
  runScript("scripts/bootstrap-env-local.ts");

  console.log("\n→ Patching hosted Auth redirect URLs…");
  runScript("scripts/patch-supabase-auth-urls.ts");

  const env = parseEnv(await readFile(ENV_LOCAL, "utf8"));
  const url = env.get("NEXT_PUBLIC_SUPABASE_URL")?.trim();
  const anonKey = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")?.trim();
  if (!url || !anonKey) {
    throw new Error(".env.local is missing Supabase URL or anon key after bootstrap.");
  }

  await smokeTestPublicApi(url, anonKey);

  console.log("\nSupabase reconnected.");
  console.log("Restart dev server: rm -rf .next && npm run dev");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
