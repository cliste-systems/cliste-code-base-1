/**
 * Fill Train Cara knowledge for a retail test store (admin §1–9).
 *
 *   npx tsx scripts/complete-retail-train-cara.ts
 *   npx tsx scripts/complete-retail-train-cara.ts --email shop@cliste.test
 *   npx tsx scripts/complete-retail-train-cara.ts --org <uuid> [--go-live]
 */

import "./mock-server-only.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

import {
  defaultBankHolidayConfig,
  serializeBusinessHours,
  type WeekSchedule,
} from "../src/lib/business-hours";
import { CLISTE_DEFAULT_ELEVENLABS_VOICE_ID } from "../src/lib/onboarding-voice-presets";
import { regenerateCaraCustomPrompt } from "../src/lib/cara-prompt-from-org";
import { syncStoreDepartmentsToOrg } from "../src/lib/sync-store-departments";
import {
  buildDefaultVoiceGreeting,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "../src/lib/voice-greeting";
import { createAdminClient } from "../src/utils/supabase/admin";

const DEFAULT_EMAIL = "shop@cliste.test";
const SMOKE_NAME = "[smoke test] Murphy's SuperValu Killarney";
const SMOKE_TAG = "[smoke test]";

function retailWeekSchedule(): WeekSchedule {
  return {
    monday: { open: true, start: "08:00", end: "21:00" },
    tuesday: { open: true, start: "08:00", end: "21:00" },
    wednesday: { open: true, start: "08:00", end: "21:00" },
    thursday: { open: true, start: "08:00", end: "21:00" },
    friday: { open: true, start: "08:00", end: "21:00" },
    saturday: { open: true, start: "08:00", end: "21:00" },
    sunday: { open: true, start: "09:00", end: "18:00" },
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  let orgId = "";
  let email = DEFAULT_EMAIL;
  let goLive = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org" && args[i + 1]) orgId = args[++i];
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    if (args[i] === "--go-live") goLive = true;
  }
  return { orgId, email, goLive };
}

async function resolveOrgId(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  email: string,
): Promise<{ organizationId: string; accountId: string; ownerEmail: string }> {
  if (orgId) {
    const { data: org } = await admin
      .from("organizations")
      .select("id, account_id")
      .eq("id", orgId)
      .maybeSingle();
    if (!org?.id) throw new Error(`No organization ${orgId}`);
    return {
      organizationId: org.id as string,
      accountId: org.account_id as string,
      ownerEmail: email,
    };
  }

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  const user = users.users.find(
    (u) => u.email?.trim().toLowerCase() === email.trim().toLowerCase(),
  );
  if (!user?.id) throw new Error(`No auth user for ${email}`);

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id, account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.organization_id) {
    throw new Error(`No organization for ${email}`);
  }

  return {
    organizationId: profile.organization_id as string,
    accountId: profile.account_id as string,
    ownerEmail: email,
  };
}

async function main() {
  const { orgId: argOrgId, email, goLive } = parseArgs();
  const admin = createAdminClient();
  const { organizationId, accountId, ownerEmail } = await resolveOrgId(
    admin,
    argOrgId,
    email,
  );
  const now = new Date().toISOString();

  const businessHours = serializeBusinessHours(retailWeekSchedule(), {
    bankHolidays: { ...defaultBankHolidayConfig(), configured: true, open: false },
  });

  const greeting = buildDefaultVoiceGreeting(
    SMOKE_NAME.replace(SMOKE_TAG, "").trim(),
    VOICE_ASSISTANT_DEFAULT_NAME,
    "How can I help you today?",
  );

  const businessDescription =
    "Independent supermarket — grocery, deli, butcher, bakery, and off-licence.";
  const knowledgeSummary =
    "Murphy's SuperValu Killarney is a local supermarket on Main Street. Cara answers opening hours, department questions, and takes messages for the shop team.";
  const exclusions =
    "No stock confirmations, shelf prices, age-restricted sales, or allergen guarantees from memory.";
  const extraNotes =
    "Direct callers to the shop floor or take a message. Never quote live prices or stock.";
  const faqs = [
    {
      question: "Do you have click and collect?",
      answer: "Yes — ask at Customer Service and we'll point you to the right team.",
    },
    {
      question: "Where is the deli counter?",
      answer: "At the back of the shop, next to the bakery.",
    },
    {
      question: "What are your Sunday hours?",
      answer: "Sunday 9:00–18:00. Bank holidays may vary.",
    },
    {
      question: "Is there parking nearby?",
      answer: "Street parking on Main Street and a small car park behind the store.",
    },
  ];
  const detailsToCollect =
    "Caller name, phone number, what they need, and best time to call back.";

  const { error: orgErr } = await admin
    .from("organizations")
    .update({
      name: SMOKE_NAME,
      agent_business_type: "Retail & Grocery — local supermarket",
      raw_business_description: businessDescription,
      business_knowledge_summary: knowledgeSummary,
      agent_services_not_offered: exclusions,
      agent_extra_notes: extraNotes,
      agent_opening_hours: "Monday–Saturday 8:00–21:00, Sunday 9:00–18:00.",
      business_hours: businessHours,
      agent_faqs: faqs,
      agent_details_to_collect: detailsToCollect,
      quote_prices_on_calls: false,
      block_anonymous_callers: true,
      call_routing_mode: "cliste_number",
      assistant_display_name: VOICE_ASSISTANT_DEFAULT_NAME,
      agent_voice_id: CLISTE_DEFAULT_ELEVENLABS_VOICE_ID,
      greeting,
      train_cara_step: "done",
      updated_at: now,
      ...(goLive
        ? { is_active: true, cara_online_since: now }
        : {}),
    })
    .eq("id", organizationId);

  if (orgErr) throw new Error(orgErr.message);

  await admin
    .from("accounts")
    .update({
      provision_source: "managed",
      name: SMOKE_NAME,
      updated_at: now,
    })
    .eq("id", accountId);

  const { data: existingInvite } = await admin
    .from("admin_invites")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("email", ownerEmail)
    .maybeSingle();

  if (!existingInvite?.id) {
    await admin.from("admin_invites").insert({
      organization_id: organizationId,
      email: ownerEmail,
      recipient_name: "Pat Murphy",
      sent_at: now,
      accepted_at: now,
      updated_at: now,
    });
  }

  const { data: orgPhone } = await admin
    .from("organizations")
    .select("phone_number, store_public_number")
    .eq("id", organizationId)
    .maybeSingle();

  const mainLine =
    (orgPhone?.phone_number as string | null) ??
    (orgPhone?.store_public_number as string | null) ??
    null;

  const { error: phoneErr } = await admin.from("store_phone_systems").upsert({
    organization_id: organizationId,
    system_type: "pbx",
    vendor: "Avaya IP Office",
    handset_count: 8,
    transfer_method: "dial_out",
    warm_transfer_hardware_status: "go",
    main_line_e164: mainLine,
    has_ddi_range: true,
    ddi_pattern: "64123xxx",
    notes: `${SMOKE_TAG} QA seed — PBX with DDI range for transfer tests.`,
    updated_at: now,
  });
  if (phoneErr) throw new Error(phoneErr.message);

  const { data: departments } = await admin
    .from("store_departments")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  const ddiBase = "+35364123";
  for (let i = 0; i < (departments ?? []).length; i++) {
    const dept = departments![i]!;
    const directDial = `${ddiBase}${String(i + 1).padStart(3, "0")}`;
    await admin
      .from("store_departments")
      .update({
        extension: String(100 + i),
        direct_dial_e164: directDial,
        transfer_enabled: true,
        updated_at: now,
      })
      .eq("id", dept.id);
  }

  const sync = await syncStoreDepartmentsToOrg(admin, organizationId);
  if (!sync.ok) throw new Error(sync.message);

  const regen = await regenerateCaraCustomPrompt(admin, organizationId);
  if (!regen.ok) throw new Error(regen.message);

  const { data: orgAfter } = await admin
    .from("organizations")
    .select("custom_prompt, prompt_compile_warnings, is_active, cara_online_since")
    .eq("id", organizationId)
    .maybeSingle();

  const warnings = orgAfter?.prompt_compile_warnings;
  const warningCount = Array.isArray(warnings) ? warnings.length : 0;

  console.log("\n✓ Retail Train Cara complete\n");
  console.log(`  Org ID:     ${organizationId}`);
  console.log(`  Name:       ${SMOKE_NAME}`);
  console.log(`  Owner:      ${ownerEmail}`);
  console.log(`  Prompt:     ${String(orgAfter?.custom_prompt ?? "").length} chars`);
  console.log(`  Warnings:   ${warningCount}`);
  console.log(`  Go-live:    ${orgAfter?.is_active ? "active" : "inactive"}`);
  if (orgAfter?.cara_online_since) {
    console.log(`  Online since: ${orgAfter.cara_online_since}`);
  }
  console.log(
    "\n  Admin training: /admin/customers/" +
      organizationId +
      "/cara-training\n",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
