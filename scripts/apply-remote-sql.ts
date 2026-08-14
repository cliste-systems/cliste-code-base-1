import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { config } from "dotenv";

import {
  isProductionSupabaseRef,
  requireDestructiveScriptConfirmation,
  resolveSupabaseProjectRef,
} from "./destructive-script-guard";

config({ path: ".env.local" });

const PROJECT_REF = "rtoebbwzwxcnscsxghww";

async function readAccessToken(): Promise<string> {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim();
  }

  try {
    const cliToken = (
      await readFile(join(homedir(), ".supabase", "access-token"), "utf8")
    ).trim();
    if (cliToken) return cliToken;
  } catch {
    // fall through
  }

  throw new Error(
    "No Supabase access token. Run `supabase login` or set SUPABASE_ACCESS_TOKEN.",
  );
}

async function runSql(token: string, query: string): Promise<void> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SQL failed (${response.status}): ${text}`);
  }

  console.log(text || "OK");
}

function sqlLooksDestructive(query: string): boolean {
  return /\b(drop\s+table|truncate\s+|delete\s+from\s+(?!public\.security_auth_events\b))/i.test(
    query,
  );
}

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error("Usage: npx tsx scripts/apply-remote-sql.ts <path-to.sql>");
    process.exit(1);
  }

  const query = await readFile(sqlPath, "utf8");
  const ref = resolveSupabaseProjectRef();
  const isVersionedMigration = sqlPath.replace(/\\/g, "/").includes("supabase/migrations/");
  if (
    !isVersionedMigration &&
    sqlLooksDestructive(query) &&
    ref &&
    isProductionSupabaseRef(ref) &&
    process.env.CLISTE_ALLOW_DESTRUCTIVE_ON_PROD !== "1"
  ) {
    await requireDestructiveScriptConfirmation({
      actionLabel: `RUN DESTRUCTIVE SQL from ${sqlPath}`,
    });
  }

  const token = await readAccessToken();
  await runSql(token, query);
  console.log(`Applied ${sqlPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
