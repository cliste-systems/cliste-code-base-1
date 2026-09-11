/**
 * Verify Kavanaghs retail demo readiness before the manager meeting.
 *
 *   npx tsx scripts/rehearse-kavanaghs-demo.ts
 *   npx tsx scripts/rehearse-kavanaghs-demo.ts --manager-phone +35387...
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";

const ORG_SLUG = "kavanaghs-supervalu-donegal-town";
const RETAIL_LINE_E164 = "+353749759508";

function parseManagerPhone(): string | null {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--manager-phone" && args[i + 1]) return args[++i];
  }
  return process.env.KAVANAGHS_MANAGER_PHONE?.trim() || null;
}

async function main() {
  const admin = createAdminClient();
  const expectedManagerPhone = parseManagerPhone();
  const failures: string[] = [];

  const { data: org, error } = await admin
    .from("organizations")
    .select(
      "id, name, slug, phone_number, notification_phone, fallback_number, greeting, custom_prompt, is_active, niche, call_routing_mode",
    )
    .eq("slug", ORG_SLUG)
    .maybeSingle();

  if (error || !org?.id) {
    throw new Error(error?.message ?? `Org ${ORG_SLUG} not found — run seed-kavanaghs-retail-demo.ts first.`);
  }

  const checks: Array<[string, boolean]> = [
    ["Org name is Kavanaghs", org.name === "Kavanaghs SuperValu Donegal Town"],
    ["Retail niche", org.niche === "retail"],
    ["Org active", org.is_active === true],
    ["9508 assigned", org.phone_number === RETAIL_LINE_E164],
    ["Custom prompt compiled", Boolean(String(org.custom_prompt ?? "").trim().length > 200)],
    ["Greeting mentions Kavanaghs", String(org.greeting ?? "").includes("Kavanaghs")],
    ["Notification phone set", Boolean(String(org.notification_phone ?? "").trim())],
    ["Fallback number set", Boolean(String(org.fallback_number ?? "").trim())],
    ["Call routing mode", org.call_routing_mode === "cliste_number"],
  ];

  if (expectedManagerPhone) {
    checks.push([
      "Manager phone matches",
      org.notification_phone === expectedManagerPhone &&
        org.fallback_number === expectedManagerPhone,
    ]);
  }

  for (const [label, ok] of checks) {
    console.log(`${ok ? "✓" : "✗"} ${label}`);
    if (!ok) failures.push(label);
  }

  const { count: deptCount } = await admin
    .from("store_departments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("active", true);
  console.log(`${(deptCount ?? 0) >= 3 ? "✓" : "✗"} Store departments (${deptCount ?? 0})`);
  if ((deptCount ?? 0) < 3) failures.push("Store departments");

  const { count: openTickets } = await admin
    .from("action_tickets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "open");
  console.log(`${(openTickets ?? 0) >= 3 ? "✓" : "✗"} Open Action Inbox tickets (${openTickets ?? 0})`);
  if ((openTickets ?? 0) < 3) {
    failures.push("Open Action Inbox tickets — run seed-kavanaghs-dashboard-activity.ts");
  }

  const { count: callsToday } = await admin
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);
  console.log(`${(callsToday ?? 0) >= 10 ? "✓" : "✗"} Call history rows (${callsToday ?? 0})`);
  if ((callsToday ?? 0) < 10) {
    failures.push("Call history — run seed-kavanaghs-dashboard-activity.ts");
  }

  console.log("\nLive demo script:");
  console.log(`  1. Call ${RETAIL_LINE_E164} — Sunday closing time + who is the store manager`);
  console.log("  2. Call again — birthday cake order for Saturday (name: Aoife)");
  console.log("  3. Call again — speak to manager about a missed delivery");
  console.log("  4. Dashboard → Action Inbox + Call History on kavanaghs@cliste.test\n");

  if (failures.length > 0) {
    console.error(`Failed checks: ${failures.join(", ")}`);
    process.exit(1);
  }

  console.log("Demo readiness checks passed.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
