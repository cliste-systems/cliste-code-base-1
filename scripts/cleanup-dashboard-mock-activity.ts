/**
 * Remove seeded demo rows from a tenant dashboard (calls, inbox, training, usage).
 * Overview (/dashboard) keeps static preview charts via dashboard-home-mock.
 *
 *   npx tsx scripts/cleanup-dashboard-mock-activity.ts
 *   npx tsx scripts/cleanup-dashboard-mock-activity.ts --org e79ac0f3-...
 *   npx tsx scripts/cleanup-dashboard-mock-activity.ts --email kavanaghs@cliste.test
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import {
  DASHBOARD_MOCK_CALLER_PREFIX,
  DASHBOARD_MOCK_REHEARSAL_CALLER_PREFIX,
  DASHBOARD_MOCK_REHEARSAL_MARKER,
  DASHBOARD_SEED_TRAINING_GAP_SUMMARIES,
} from "../src/lib/dashboard-mock-cleanup.js";
import { createAdminClient } from "../src/utils/supabase/admin";

const DEFAULT_OWNER_EMAIL = "kavanaghs@cliste.test";
const DEFAULT_ORG_SLUG = "kavanaghs-supervalu-donegal-town";

function parseArgs(): { email: string; orgId: string } {
  const args = process.argv.slice(2);
  let email = DEFAULT_OWNER_EMAIL;
  let orgId = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    if (args[i] === "--org" && args[i + 1]) orgId = args[++i];
  }
  return { email, orgId };
}

async function resolveOrgId(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  orgIdArg: string,
): Promise<string> {
  if (orgIdArg.trim()) return orgIdArg.trim();

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id, organization_id")
    .eq("email", email)
    .maybeSingle();

  const fromProfile =
    profile?.active_organization_id ?? profile?.organization_id ?? null;
  if (fromProfile) return fromProfile;

  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", DEFAULT_ORG_SLUG)
    .maybeSingle();
  if (org?.id) return org.id as string;

  throw new Error(`Could not resolve org for ${email}`);
}

async function countMatching(
  admin: ReturnType<typeof createAdminClient>,
  table: "call_logs" | "action_tickets" | "cara_training_items" | "usage_records",
  orgId: string,
): Promise<number> {
  if (table === "call_logs") {
    const { count } = await admin
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .or(
        [
          `caller_number.like.${DASHBOARD_MOCK_CALLER_PREFIX}%`,
          `caller_number.like.${DASHBOARD_MOCK_REHEARSAL_CALLER_PREFIX}%`,
          "call_sid.like.KAV-TEST-%",
          "call_sid.like.RT-TEST-%",
          `ai_summary.ilike.%${DASHBOARD_MOCK_REHEARSAL_MARKER}%`,
        ].join(","),
      );
    return count ?? 0;
  }

  if (table === "action_tickets") {
    const { count } = await admin
      .from("action_tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .or(
        [
          `caller_number.like.${DASHBOARD_MOCK_CALLER_PREFIX}%`,
          `caller_number.like.${DASHBOARD_MOCK_REHEARSAL_CALLER_PREFIX}%`,
          `summary.ilike.%${DASHBOARD_MOCK_REHEARSAL_MARKER}%`,
        ].join(","),
      );
    return count ?? 0;
  }

  if (table === "cara_training_items") {
    const { count: rehearsalCount } = await admin
      .from("cara_training_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .ilike("gap_summary", `%${DASHBOARD_MOCK_REHEARSAL_MARKER}%`);

    const { count: seedCount } = await admin
      .from("cara_training_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("gap_summary", [...DASHBOARD_SEED_TRAINING_GAP_SUMMARIES]);

    return (rehearsalCount ?? 0) + (seedCount ?? 0);
  }

  const { count } = await admin
    .from("usage_records")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .or("call_sid.like.KAV-TEST-%,call_sid.like.RT-TEST-%");
  return count ?? 0;
}

async function deleteMockRows(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<void> {
  await admin
    .from("call_logs")
    .delete()
    .eq("organization_id", orgId)
    .or(
      [
        `caller_number.like.${DASHBOARD_MOCK_CALLER_PREFIX}%`,
        `caller_number.like.${DASHBOARD_MOCK_REHEARSAL_CALLER_PREFIX}%`,
        "call_sid.like.KAV-TEST-%",
        "call_sid.like.RT-TEST-%",
        `ai_summary.ilike.%${DASHBOARD_MOCK_REHEARSAL_MARKER}%`,
      ].join(","),
    );

  await admin
    .from("action_tickets")
    .delete()
    .eq("organization_id", orgId)
    .or(
      [
        `caller_number.like.${DASHBOARD_MOCK_CALLER_PREFIX}%`,
        `caller_number.like.${DASHBOARD_MOCK_REHEARSAL_CALLER_PREFIX}%`,
        `summary.ilike.%${DASHBOARD_MOCK_REHEARSAL_MARKER}%`,
      ].join(","),
    );

  await admin
    .from("cara_training_items")
    .delete()
    .eq("organization_id", orgId)
    .ilike("gap_summary", `%${DASHBOARD_MOCK_REHEARSAL_MARKER}%`);

  await admin
    .from("cara_training_items")
    .delete()
    .eq("organization_id", orgId)
    .in("gap_summary", [...DASHBOARD_SEED_TRAINING_GAP_SUMMARIES]);

  await admin
    .from("usage_records")
    .delete()
    .eq("organization_id", orgId)
    .or("call_sid.like.KAV-TEST-%,call_sid.like.RT-TEST-%");
}

async function main() {
  const { email, orgId: orgIdArg } = parseArgs();
  const admin = createAdminClient();
  const orgId = await resolveOrgId(admin, email, orgIdArg);

  console.log(`\nCleaning dashboard mock activity for org ${orgId}\n`);

  const before = {
    callLogs: await countMatching(admin, "call_logs", orgId),
    actionTickets: await countMatching(admin, "action_tickets", orgId),
    caraTrainingItems: await countMatching(admin, "cara_training_items", orgId),
    usageRecords: await countMatching(admin, "usage_records", orgId),
  };

  await deleteMockRows(admin, orgId);

  console.log("Removed:");
  console.log(`  call_logs:            ${before.callLogs}`);
  console.log(`  action_tickets:       ${before.actionTickets}`);
  console.log(`  cara_training_items:  ${before.caraTrainingItems}`);
  console.log(`  usage_records:        ${before.usageRecords}`);
  console.log("\n✓ Overview (/dashboard) still uses static preview charts for Kavanaghs.");
  console.log("  Other dashboard pages now show live data only.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
