/**
 * One-time: clear synced_to_stripe_at on usage rows that were incorrectly
 * marked synced when no platform_customer_id existed.
 *
 * Usage: npx tsx scripts/backfill-usage-sync.ts
 */
import "dotenv/config";

import { createAdminClient } from "../src/utils/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("usage_records")
    .select("id, organization_id, sync_skip_reason, synced_to_stripe_at")
    .eq("sync_skip_reason", "no_customer")
    .not("synced_to_stripe_at", "is", null);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) {
    console.log("No rows to backfill.");
    return;
  }

  const { error: updErr } = await admin
    .from("usage_records")
    .update({ synced_to_stripe_at: null })
    .in("id", ids);

  if (updErr) {
    console.error(updErr.message);
    process.exit(1);
  }

  console.log(`Cleared synced_to_stripe_at on ${ids.length} usage row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
