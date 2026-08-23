/**
 * Smoke checks for admin-led retail onboarding v2 (non-destructive reads + optional insert).
 * Run: npx tsx scripts/smoke-retail-onboarding-v2.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { buildTenantProvisioningStatus } from "../src/lib/tenant-provisioning-status";
import { createAdminClient } from "../src/utils/supabase/admin";

async function main() {
  const admin = createAdminClient();

  const { error: tableErr } = await admin.from("admin_invites").select("id").limit(1);
  if (tableErr) {
    throw new Error(`admin_invites missing: ${tableErr.message}`);
  }
  console.log("OK admin_invites table readable");

  const invitedStatus = buildTenantProvisioningStatus({
    organizationId: "00000000-0000-4000-8000-000000000099",
    organizationName: "[smoke test] SuperValu Donegal Town",
    assistantDisplayName: "Cara",
    greeting: "",
    customPrompt: "",
    phoneNumber: "",
    poolPhoneE164: null,
    poolPhoneAssigned: false,
    callRoutingMode: "cliste_number",
    fallbackNumber: "",
    storePublicNumber: "",
    divertCarrier: "",
    businessHours: null,
    agentServicesDepartments: [],
    agentFaqs: [],
    agentVoiceId: "",
    agentBusinessType: "",
    businessKnowledgeSummary: "",
    agentServicesNotOffered: "",
    agentExtraNotes: "",
    promptCompileWarnings: [],
    ownerUserId: null,
    ownerHasLegalAcceptances: false,
    inviteSentAt: new Date().toISOString(),
    inviteAcceptedAt: null,
    hasInboundCallLog: false,
    caraOnlineSince: null,
  });
  console.log("OK provisioning stage for fresh invite:", invitedStatus.stage);
  if (invitedStatus.stage !== "invited") {
    throw new Error(`Expected invited stage, got ${invitedStatus.stage}`);
  }

  const readyStatus = buildTenantProvisioningStatus({
    organizationId: "00000000-0000-4000-8000-000000000099",
    organizationName: "[smoke test] SuperValu Donegal Town",
    assistantDisplayName: "Cara",
    greeting:
      "You're through to SuperValu Donegal Town — I'm Cara, the AI assistant. This call may be recorded and transcribed. How can I help?",
    customPrompt: "compiled",
    phoneNumber: "+3531555000999",
    poolPhoneE164: "+3531555000999",
    poolPhoneAssigned: true,
    callRoutingMode: "cliste_number",
    fallbackNumber: "+353870000099",
    storePublicNumber: "+353749999099",
    divertCarrier: "vodafone",
    businessHours: {
      monday: { open: true, start: "09:00", end: "18:00" },
      _bankHolidaysConfigured: true,
      _bankHolidaysOpen: false,
    },
    agentServicesDepartments: ["Customer service"],
    agentFaqs: [{ q: "Hours?", a: "9-6" }],
    agentVoiceId: "voice-smoke",
    agentBusinessType: "Supermarket",
    businessKnowledgeSummary: "Local store.",
    agentServicesNotOffered: "No delivery",
    agentExtraNotes: "Escalate to manager.",
    promptCompileWarnings: [],
    ownerUserId: null,
    ownerHasLegalAcceptances: false,
    inviteSentAt: new Date().toISOString(),
    inviteAcceptedAt: null,
    hasInboundCallLog: false,
    caraOnlineSince: null,
  });
  console.log("OK provisioning stage when go-live ready:", readyStatus.stage);
  if (readyStatus.stage !== "ready") {
    throw new Error(`Expected ready stage, got ${readyStatus.stage}`);
  }

  const { count } = await admin
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("niche", "retail");
  console.log(`OK ${count ?? 0} retail org(s) in database`);

  console.log("Smoke checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
