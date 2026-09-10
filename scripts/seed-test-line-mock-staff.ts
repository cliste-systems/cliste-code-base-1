/**
 * Temporary mock staff for the internal SuperValu QA line (+353109307440).
 * Safe to add/remove anytime — does not touch production tenant data elsewhere.
 *
 *   npx tsx scripts/seed-test-line-mock-staff.ts
 *   npx tsx scripts/seed-test-line-mock-staff.ts --remove
 *   npx tsx scripts/seed-test-line-mock-staff.ts --org <uuid>
 */

import "./mock-server-only.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

import { regenerateCaraCustomPrompt } from "../src/lib/cara-prompt-from-org";
import { syncStoreDepartmentsToOrg } from "../src/lib/sync-store-departments";
import { createAdminClient } from "../src/utils/supabase/admin";

const DEFAULT_ORG_ID = "6b43ff25-b1e1-4c22-8fb4-2957d803120d";
const TEMP_MARKER = "## TEMP test-line mock staff (safe to delete anytime)";

const MOCK_STAFF = {
  storeManager: { name: "Garreth Ferry", role: "store_manager" as const },
  departments: [
    { name: "Fresh food", manager: "Mark OToole", sort_order: 3 },
    { name: "Ambient", manager: "Paul Gallagher", sort_order: 4 },
  ],
};

function mockExtraNotesBlock(): string {
  return [
    TEMP_MARKER,
    "Key people for test calls only:",
    `• Store manager: ${MOCK_STAFF.storeManager.name}`,
    `• Fresh food manager: ${MOCK_STAFF.departments[0]!.manager}`,
    `• Ambient manager: ${MOCK_STAFF.departments[1]!.manager}`,
  ].join("\n");
}

function stripMockExtraNotes(existing: string | null | undefined): string {
  const text = String(existing ?? "").trim();
  if (!text.includes(TEMP_MARKER)) return text;
  const before = text.split(TEMP_MARKER)[0]?.trim() ?? "";
  const afterBlock = text.slice(text.indexOf(TEMP_MARKER));
  const rest = afterBlock.includes("\n\n")
    ? afterBlock.slice(afterBlock.indexOf("\n\n") + 2).trim()
    : "";
  return [before, rest].filter(Boolean).join("\n\n").trim();
}

function mergeMockExtraNotes(existing: string | null | undefined): string {
  const base = stripMockExtraNotes(existing);
  const block = mockExtraNotesBlock();
  return base ? `${base}\n\n${block}` : block;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let orgId = DEFAULT_ORG_ID;
  let remove = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org" && args[i + 1]) orgId = args[++i]!;
    if (args[i] === "--remove") remove = true;
  }
  return { orgId, remove };
}

async function main() {
  const { orgId, remove } = parseArgs();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, agent_extra_notes")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr) throw new Error(orgErr.message);
  if (!org?.id) throw new Error(`No organization ${orgId}`);

  if (remove) {
    await admin
      .from("store_contacts")
      .delete()
      .eq("organization_id", orgId)
      .eq("name", MOCK_STAFF.storeManager.name);

    for (const dept of MOCK_STAFF.departments) {
      await admin
        .from("store_departments")
        .delete()
        .eq("organization_id", orgId)
        .eq("name", dept.name);
    }

    const { error: notesErr } = await admin
      .from("organizations")
      .update({
        agent_extra_notes: stripMockExtraNotes(org.agent_extra_notes) || null,
        updated_at: now,
      })
      .eq("id", orgId);
    if (notesErr) throw new Error(notesErr.message);

    const sync = await syncStoreDepartmentsToOrg(admin, orgId);
    if (!sync.ok) throw new Error(sync.message);

    const regen = await regenerateCaraCustomPrompt(admin, orgId);
    if (!regen.ok) throw new Error(regen.message);

    console.log("\n✓ Removed temporary test-line mock staff\n");
    console.log(`  Org: ${org.name} (${orgId})`);
    return;
  }

  const { data: existingManager } = await admin
    .from("store_contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("role", "store_manager")
    .eq("active", true)
    .maybeSingle();

  if (existingManager?.id) {
    await admin
      .from("store_contacts")
      .update({
        name: MOCK_STAFF.storeManager.name,
        role: MOCK_STAFF.storeManager.role,
        updated_at: now,
      })
      .eq("id", existingManager.id);
  } else {
    const { error: contactErr } = await admin.from("store_contacts").insert({
      organization_id: orgId,
      name: MOCK_STAFF.storeManager.name,
      role: MOCK_STAFF.storeManager.role,
      active: true,
      is_notification_target: false,
    });
    if (contactErr) throw new Error(contactErr.message);
  }

  for (const dept of MOCK_STAFF.departments) {
    const { data: existing } = await admin
      .from("store_departments")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", dept.name)
      .maybeSingle();

    if (existing?.id) {
      await admin
        .from("store_departments")
        .update({
          manager_name: dept.manager,
          sort_order: dept.sort_order,
          transfer_enabled: true,
          active: true,
          updated_at: now,
        })
        .eq("id", existing.id);
    } else {
      const { error: deptErr } = await admin.from("store_departments").insert({
        organization_id: orgId,
        name: dept.name,
        manager_name: dept.manager,
        sort_order: dept.sort_order,
        transfer_enabled: true,
        active: true,
      });
      if (deptErr) throw new Error(deptErr.message);
    }
  }

  const { error: notesErr } = await admin
    .from("organizations")
    .update({
      agent_extra_notes: mergeMockExtraNotes(org.agent_extra_notes),
      updated_at: now,
    })
    .eq("id", orgId);
  if (notesErr) throw new Error(notesErr.message);

  const sync = await syncStoreDepartmentsToOrg(admin, orgId);
  if (!sync.ok) throw new Error(sync.message);

  const regen = await regenerateCaraCustomPrompt(admin, orgId);
  if (!regen.ok) throw new Error(regen.message);

  console.log("\n✓ Added temporary test-line mock staff\n");
  console.log(`  Org:   ${org.name} (${orgId})`);
  console.log(`  Store manager: ${MOCK_STAFF.storeManager.name}`);
  for (const dept of MOCK_STAFF.departments) {
    console.log(`  ${dept.name}: ${dept.manager}`);
  }
  console.log("\n  Remove anytime:");
  console.log("    npx tsx scripts/seed-test-line-mock-staff.ts --remove\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
