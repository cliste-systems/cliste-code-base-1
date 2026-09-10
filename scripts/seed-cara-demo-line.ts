/**
 * Reset the internal demo / test line (+353749389378) to a generic Hello Cara
 * capability showcase — no SuperValu, mock staff, routes, or business data.
 *
 *   npx tsx scripts/seed-cara-demo-line.ts
 *   npx tsx scripts/seed-cara-demo-line.ts --org <uuid>
 */

import "./mock-server-only.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

import { regenerateCaraCustomPrompt } from "../src/lib/cara-prompt-from-org";
import { emptyWeekSchedule } from "../src/lib/business-hours";
import { syncStoreDepartmentsToOrg } from "../src/lib/sync-store-departments";
import {
  buildFullVoiceGreeting,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "../src/lib/voice-greeting";
import { createAdminClient } from "../src/utils/supabase/admin";

const DEFAULT_ORG_ID = "9fc358db-dc4d-44a4-b87a-654f10d04103";
const DEMO_PHONE = "+353749389378";

const DEMO_GREETING = buildFullVoiceGreeting(
  "You're through to Hello Cara, the demo line —",
  VOICE_ASSISTANT_DEFAULT_NAME,
  "What would you like to try?",
);

function parseArgs() {
  const args = process.argv.slice(2);
  let orgId = DEFAULT_ORG_ID;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org" && args[i + 1]) orgId = args[++i]!;
  }
  return { orgId };
}

async function main() {
  const { orgId } = parseArgs();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr) throw new Error(orgErr.message);
  if (!org?.id) throw new Error(`No organization ${orgId}`);

  console.log(`\nResetting demo line for ${org.name} (${orgId})…\n`);

  await admin.from("store_contacts").delete().eq("organization_id", orgId);
  await admin.from("store_departments").delete().eq("organization_id", orgId);
  await admin.from("store_phone_systems").delete().eq("organization_id", orgId);
  await admin.from("business_files").delete().eq("organization_id", orgId);

  const { error: hoursErr } = await admin
    .from("business_hours_overrides")
    .delete()
    .eq("organization_id", orgId);
  if (hoursErr && !hoursErr.message.includes("does not exist")) {
    throw new Error(hoursErr.message);
  }

  const sync = await syncStoreDepartmentsToOrg(admin, orgId);
  if (!sync.ok) throw new Error(sync.message);

  const { error: updateErr } = await admin
    .from("organizations")
    .update({
      name: "Hello Cara Demo",
      assistant_display_name: VOICE_ASSISTANT_DEFAULT_NAME,
      greeting: DEMO_GREETING,
      agent_business_type: "AI phone assistant demo",
      niche: "other",
      business_knowledge_summary: null,
      agent_opening_hours: null,
      business_hours: emptyWeekSchedule(),
      agent_service_area: null,
      agent_service_area_exclusions: null,
      agent_base_town: null,
      agent_services_departments: null,
      agent_services_departments_raw: null,
      agent_services_not_offered: null,
      agent_service_catalog_supplement: null,
      agent_business_rules: [],
      agent_cara_rules: [],
      agent_faqs: [],
      agent_location_address: null,
      agent_location_eircode: null,
      agent_location_county: null,
      agent_extra_notes: null,
      routing_links: [],
      fallback_number: null,
      quote_prices_on_calls: false,
      admin_notes: null,
      updated_at: now,
    })
    .eq("id", orgId);

  if (updateErr) throw new Error(updateErr.message);

  const regen = await regenerateCaraCustomPrompt(admin, orgId);
  if (!regen.ok) throw new Error(regen.message);

  const { data: refreshed } = await admin
    .from("organizations")
    .select("name, greeting, custom_prompt, niche, phone_number")
    .eq("id", orgId)
    .maybeSingle();

  console.log("✓ Demo line ready\n");
  console.log(`  Org:      ${refreshed?.name}`);
  console.log(`  Phone:    ${refreshed?.phone_number ?? DEMO_PHONE}`);
  console.log(`  Niche:    ${refreshed?.niche}`);
  console.log(`  Greeting: ${refreshed?.greeting?.slice(0, 120)}…`);
  console.log(`  Prompt:   ${refreshed?.custom_prompt?.length ?? 0} chars`);
  console.log("\n  Ring to try Cara:");
  console.log(`    ${DEMO_PHONE}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
