/**
 * One-off cleanup: dismiss legacy training noise (operational handoffs + hours gaps).
 *
 * Action Inbox cake/booking/callback tickets and call_gap opening-hours topics
 * should never have been in Training. New calls no longer create them; this
 * clears the backlog already sitting in the table.
 *
 *   npx tsx scripts/dismiss-legacy-training-noise.ts            # dry run (lists matches)
 *   npx tsx scripts/dismiss-legacy-training-noise.ts --apply    # dismiss them
 *   npx tsx scripts/dismiss-legacy-training-noise.ts --org <uuid> [--apply]
 */

import "./mock-server-only.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";
import {
  isRoutineHandoff,
  isStructuredHoursTopic,
} from "../src/lib/cara-training-types";

function parseArgs() {
  const args = process.argv.slice(2);
  let apply = false;
  let org: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") apply = true;
    else if (args[i] === "--org" && args[i + 1]) org = args[++i]!.trim();
  }
  return { apply, org };
}

type Row = {
  id: string;
  organization_id: string;
  gap_summary: string;
  caller_context: string | null;
  source: string;
};

function isTrainingNoise(row: Row): boolean {
  const combined = [row.gap_summary, row.caller_context ?? ""]
    .filter(Boolean)
    .join(" ");
  if (row.source === "action_inbox" && isRoutineHandoff(row.gap_summary)) {
    return true;
  }
  if (row.source === "call_gap" && isStructuredHoursTopic(combined)) {
    return true;
  }
  return false;
}

async function main() {
  const { apply, org } = parseArgs();
  const admin = createAdminClient();

  let query = admin
    .from("cara_training_items")
    .select("id, organization_id, gap_summary, caller_context, source, status")
    .in("source", ["action_inbox", "call_gap"])
    .in("status", ["awaiting_answer", "draft_ready"]);
  if (org) query = query.eq("organization_id", org);

  const { data, error } = await query;
  if (error) {
    console.error("query failed:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  const noise = rows.filter(isTrainingNoise);

  console.log(
    `Found ${noise.length} training noise item(s) to dismiss (of ${rows.length} open items).`,
  );
  for (const r of noise) {
    console.log(
      `  [${r.source}] [${r.organization_id.slice(0, 8)}] ${r.gap_summary.replace(/\s+/g, " ").slice(0, 90)}`,
    );
  }

  if (!apply) {
    console.log("\nDry run — re-run with --apply to dismiss these.");
    return;
  }
  if (noise.length === 0) return;

  const nowIso = new Date().toISOString();
  const { error: updErr } = await admin
    .from("cara_training_items")
    .update({ status: "dismissed", dismissed_at: nowIso, updated_at: nowIso })
    .in(
      "id",
      noise.map((r) => r.id),
    );
  if (updErr) {
    console.error("update failed:", updErr.message);
    process.exit(1);
  }
  console.log(`\nDismissed ${noise.length} item(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
