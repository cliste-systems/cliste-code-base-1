/**
 * One-off readiness matrix checks against hosted dev Supabase (no UI).
 *   npx tsx scripts/verify-readiness-matrix.ts
 */

import "./mock-server-only.ts";

import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";
import { adminCaraTrainingSectionChecks } from "../src/lib/admin-cara-training-readiness";
import { loadStorePhoneSystem } from "../src/lib/load-store-phone-system";
import { parseAdminGreetingParts } from "../src/lib/admin-store-readiness";
import { parseBusinessHoursBundle } from "../src/lib/business-hours";
import { parseAgentFaqs } from "../src/app/(dashboard)/dashboard/agent-setup/agent-faqs";

const ORG_ID = process.env.READINESS_ORG_ID?.trim() || "9fc358db-dc4d-44a4-b87a-654f10d04103";

async function main() {
  const admin = createAdminClient();

  const { count: orgCount } = await admin
    .from("organizations")
    .select("id", { count: "exact", head: true });

  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, is_active, phone_number, account_id")
    .order("created_at", { ascending: true });

  const { count: callCount } = await admin
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ORG_ID);

  const { data: outcomes } = await admin
    .from("call_logs")
    .select("outcome")
    .eq("organization_id", ORG_ID);

  const outcomeTally: Record<string, number> = {};
  for (const row of outcomes ?? []) {
    const o = String(row.outcome ?? "unknown");
    outcomeTally[o] = (outcomeTally[o] ?? 0) + 1;
  }

  const { data: minutesRows } = await admin
    .from("call_logs")
    .select("duration_seconds")
    .eq("organization_id", ORG_ID);
  const totalSeconds = (minutesRows ?? []).reduce(
    (sum, r) => sum + Number(r.duration_seconds ?? 0),
    0,
  );

  const { count: openTickets } = await admin
    .from("action_tickets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ORG_ID)
    .eq("status", "open");

  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, name, account_id, greeting, custom_prompt, prompt_compile_warnings, assistant_display_name, agent_voice_id, agent_business_type, business_knowledge_summary, agent_services_not_offered, agent_extra_notes, agent_faqs, agent_details_to_collect, quote_prices_on_calls, business_hours, phone_number, is_active",
    )
    .eq("id", ORG_ID)
    .maybeSingle();

  const { data: account } = await admin
    .from("accounts")
    .select("provision_source")
    .eq("id", org?.account_id as string)
    .maybeSingle();

  const { data: invite } = await admin
    .from("admin_invites")
    .select("id")
    .eq("organization_id", ORG_ID)
    .maybeSingle();

  const { data: departments } = await admin
    .from("store_departments")
    .select("name, active")
    .eq("organization_id", ORG_ID);

  const phoneSystem = await loadStorePhoneSystem(admin, ORG_ID);

  const greetingParts = parseAdminGreetingParts({
    name: String(org?.name ?? ""),
    greeting: String(org?.greeting ?? ""),
    assistantDisplayName: String(org?.assistant_display_name ?? ""),
    storeCode: "",
    retailBanner: null,
    agentLocationAddress: "",
    agentLocationEircode: "",
    phoneNumber: String(org?.phone_number ?? ""),
    storePublicNumber: "",
    divertCarrier: null,
    divertVerifiedAt: null,
    departments: [],
    contacts: [],
    businessHours: org?.business_hours,
    agentBusinessType: "",
    businessKnowledgeSummary: "",
    customPrompt: "",
    promptCompileWarnings: [],
  });

  const hoursBundle = parseBusinessHoursBundle(org?.business_hours);
  const sectionChecks = adminCaraTrainingSectionChecks({
    assistantDisplayName: String(org?.assistant_display_name ?? ""),
    agentVoiceId: String(org?.agent_voice_id ?? ""),
    greetingIntro: greetingParts.intro,
    greetingClosing: greetingParts.closing,
    greeting: String(org?.greeting ?? ""),
    agentBusinessType: String(org?.agent_business_type ?? ""),
    businessKnowledgeSummary: String(org?.business_knowledge_summary ?? ""),
    departments: (departments ?? []).map((d) => ({
      name: String(d.name),
      active: Boolean(d.active),
    })),
    agentServicesNotOffered: String(org?.agent_services_not_offered ?? ""),
    agentExtraNotes: String(org?.agent_extra_notes ?? ""),
    businessHours: org?.business_hours,
    agentFaqs: parseAgentFaqs(org?.agent_faqs),
    agentDetailsToCollect: String(org?.agent_details_to_collect ?? ""),
    phoneSystem,
    canTransfer: true,
    quotePricesOnCalls: org?.quote_prices_on_calls as boolean | undefined,
    customPrompt: String(org?.custom_prompt ?? ""),
    promptCompileWarnings: org?.prompt_compile_warnings,
  });

  const { data: transferVerified } = await admin
    .from("store_phone_systems")
    .select("transfer_verified_at")
    .eq("organization_id", ORG_ID)
    .maybeSingle();

  const { count: gapFromWebhook } = await admin
    .from("cara_training_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ORG_ID)
    .ilike("gap_summary", "%EV charging%");

  console.log("\n=== Readiness matrix (Supabase) ===\n");
  console.log(`Organizations total:     ${orgCount ?? 0}`);
  console.log(`Customer list rows:      ${orgs?.length ?? 0}`);
  for (const o of orgs ?? []) {
    console.log(`  - ${o.name} (${o.id}) active=${o.is_active} did=${o.phone_number}`);
  }
  console.log(`\nOrg ${ORG_ID} calls:       ${callCount ?? 0}`);
  console.log(`Total duration (sec):    ${totalSeconds}`);
  console.log(`Open action tickets:     ${openTickets ?? 0}`);
  console.log(`Outcome tally:           ${JSON.stringify(outcomeTally)}`);
  console.log(`Provision source:        ${account?.provision_source} (invite=${Boolean(invite)})`);
  console.log(`Transfer verified_at:    ${transferVerified?.transfer_verified_at ?? "null"}`);
  console.log(`EV charging gap items:   ${gapFromWebhook ?? 0}`);
  console.log("\nTrain Cara sections:");
  for (const s of sectionChecks) {
    console.log(`  ${s.complete ? "✓" : "✗"} ${s.label}: ${s.detail}`);
  }
  console.log("\nDASHBOARD_HOME_MOCK:     " + (process.env.DASHBOARD_HOME_MOCK === "1" ? "ON (bad)" : "off"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
