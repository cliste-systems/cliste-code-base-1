/**
 * Apply retail store setup migrations 083–086 to hosted Supabase.
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env.local or `supabase login`.
 *
 *   npx tsx scripts/apply-retail-migrations.ts
 */

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const MIGRATIONS = [
  "supabase/migrations/083_retail_store_identity.sql",
  "supabase/migrations/084_store_departments.sql",
  "supabase/migrations/085_store_contacts.sql",
  "supabase/migrations/086_retail_outcome_transferred.sql",
] as const;

async function main() {
  for (const path of MIGRATIONS) {
    await readFile(path, "utf8");
    console.log(`\n→ Applying ${path}…`);
    const result = spawnSync(
      "npx",
      ["tsx", "scripts/apply-remote-sql.ts", path],
      { stdio: "inherit", env: process.env },
    );
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
  console.log("\n✓ Migrations 083–086 applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
