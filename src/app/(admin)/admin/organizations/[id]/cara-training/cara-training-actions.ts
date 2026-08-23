"use server";

import { revalidatePath } from "next/cache";

import { parseAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  composeAdminGreeting,
  parseAdminGreetingParts,
} from "@/lib/admin-store-readiness";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import { parseAgentCaraRules } from "@/lib/agent-cara-rules";
import { parseCaraConduct } from "@/lib/agent-cara-conduct";
import { AGENT_CONFIG_REVALIDATE_PATHS } from "@/lib/dashboard-routes";
import { greetingDisclosesAi } from "@/lib/greeting-discloses-ai";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import {
  defaultBankHolidayConfig,
  defaultWeekSchedule,
  parseBusinessHoursBundle,
  serializeBusinessHours,
  type BankHolidayConfig,
  type WeekSchedule,
} from "@/lib/business-hours";
import { loadOrganizationProvisioning } from "@/lib/load-provisioning-pipeline";
import { requireAdminSessionUser } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ActionResult = { ok: true } | { ok: false; message: string };

function revalidateAll(orgId: string) {
  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath(`/admin/organizations/${orgId}/cara-training`);
  revalidatePath("/admin/onboarding");
  for (const path of AGENT_CONFIG_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export type CaraTrainingData = {
  organizationId: string;
  name: string;
  assistantDisplayName: string;
  greeting: string;
  greetingIntro: string;
  greetingClosing: string;
  agentVoiceId: string;
  agentBusinessType: string;
  businessKnowledgeSummary: string;
  agentExtraNotes: string;
  agentLocationAddress: string;
  agentLocationEircode: string;
  agentLocationCounty: string;
  agentBaseTown: string;
  agentServicesDepartments: string;
  agentServicesNotOffered: string;
  agentBusinessRules: string[];
  agentCaraRules: string[];
  agentCaraConduct: string;
  agentFaqs: { question: string; answer: string }[];
  quotePricesOnCalls: boolean;
  blockAnonymousCallers: boolean;
  openingHoursSchedule: WeekSchedule;
  open24_7: boolean;
  bankHolidays: BankHolidayConfig;
  customPrompt: string;
  promptCompileWarnings: unknown[];
};

export async function loadCaraTrainingData(
  organizationId: string,
): Promise<CaraTrainingData | null> {
  if (!UUID_RE.test(organizationId)) return null;
  await requireAdminSessionUser();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, name, greeting, custom_prompt, prompt_compile_warnings, assistant_display_name, agent_voice_id, agent_business_type, business_knowledge_summary, agent_extra_notes, agent_location_address, agent_location_eircode, agent_location_county, agent_base_town, agent_services_departments, agent_services_not_offered, agent_business_rules, agent_cara_rules, agent_cara_conduct, agent_faqs, quote_prices_on_calls, block_anonymous_callers, business_hours",
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (!org?.id) return null;

  const { schedule, meta } = parseBusinessHoursBundle(org.business_hours);
  const parts = parseAdminGreetingParts({
    organizationId,
    name: String(org.name ?? ""),
    slug: "",
    niche: "retail",
    accountId: null,
    storeCode: "",
    retailBanner: "",
    agentLocationAddress: "",
    agentLocationEircode: "",
    agentLocationCounty: "",
    timezone: "",
    phoneNumber: "",
    storePublicNumber: "",
    callRoutingMode: "cliste_number",
    fallbackNumber: "",
    divertCarrier: "",
    divertVerifiedAt: null,
    retailFacilities: [],
    retailDelivery: {},
    retailClickCollectUrl: "",
    retailLoyaltyProgram: "",
    quotePricesOnCalls: false,
    greeting: String(org.greeting ?? ""),
    customPrompt: String(org.custom_prompt ?? ""),
    promptCompileWarnings: [],
    assistantDisplayName: String(org.assistant_display_name ?? "Cara"),
    agentVoiceId: String(org.agent_voice_id ?? ""),
    isActive: false,
    caraOnlineSince: null,
    businessHours: org.business_hours,
    agentOpeningHours: "",
    routingLinks: [],
    departments: [],
    contacts: [],
  });

  return {
    organizationId,
    name: String(org.name ?? ""),
    assistantDisplayName: String(org.assistant_display_name ?? "Cara"),
    greeting: String(org.greeting ?? ""),
    greetingIntro: parts.intro,
    greetingClosing: parts.closing,
    agentVoiceId: String(org.agent_voice_id ?? ""),
    agentBusinessType: String(org.agent_business_type ?? ""),
    businessKnowledgeSummary: String(org.business_knowledge_summary ?? ""),
    agentExtraNotes: String(org.agent_extra_notes ?? ""),
    agentLocationAddress: String(org.agent_location_address ?? ""),
    agentLocationEircode: String(org.agent_location_eircode ?? ""),
    agentLocationCounty: String(org.agent_location_county ?? ""),
    agentBaseTown: String(org.agent_base_town ?? ""),
    agentServicesDepartments: String(org.agent_services_departments ?? ""),
    agentServicesNotOffered: String(org.agent_services_not_offered ?? ""),
    agentBusinessRules: parseAgentBusinessRules(org.agent_business_rules),
    agentCaraRules: parseAgentCaraRules(org.agent_cara_rules),
    agentCaraConduct: String(org.agent_cara_conduct ?? ""),
    agentFaqs: parseAgentFaqs(org.agent_faqs).map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    quotePricesOnCalls: org.quote_prices_on_calls === true,
    blockAnonymousCallers: org.block_anonymous_callers === true,
    openingHoursSchedule: schedule,
    open24_7: meta.open24_7 === true,
    bankHolidays: meta.bankHolidays ?? defaultBankHolidayConfig(),
    customPrompt: String(org.custom_prompt ?? ""),
    promptCompileWarnings: Array.isArray(org.prompt_compile_warnings)
      ? org.prompt_compile_warnings
      : [],
  };
}

export async function saveCaraTraining(
  organizationId: string,
  payload: Omit<
    CaraTrainingData,
    "organizationId" | "greeting" | "customPrompt" | "promptCompileWarnings"
  >,
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }

  await requireAdminSessionUser();
  const admin = createAdminClient();

  const greeting = composeAdminGreeting(
    {
      organizationId,
      name: payload.name,
      slug: "",
      niche: "retail",
      accountId: null,
      storeCode: "",
      retailBanner: "",
      agentLocationAddress: payload.agentLocationAddress,
      agentLocationEircode: payload.agentLocationEircode,
      agentLocationCounty: payload.agentLocationCounty,
      timezone: "",
      phoneNumber: "",
      storePublicNumber: "",
      callRoutingMode: "cliste_number",
      fallbackNumber: "",
      divertCarrier: "",
      divertVerifiedAt: null,
      retailFacilities: [],
      retailDelivery: {},
      retailClickCollectUrl: "",
      retailLoyaltyProgram: "",
      quotePricesOnCalls: payload.quotePricesOnCalls,
      greeting: "",
      customPrompt: "",
      promptCompileWarnings: [],
      assistantDisplayName: payload.assistantDisplayName,
      agentVoiceId: payload.agentVoiceId,
      isActive: false,
      caraOnlineSince: null,
      businessHours: serializeBusinessHours(payload.openingHoursSchedule, {
        open24_7: payload.open24_7,
        bankHolidays: payload.bankHolidays,
      }),
      agentOpeningHours: "",
      routingLinks: [],
      departments: [],
      contacts: [],
    },
    payload.greetingIntro,
    payload.greetingClosing,
  );

  if (!greetingDisclosesAi(greeting, payload.assistantDisplayName)) {
    return {
      ok: false,
      message:
        "Greeting must disclose that callers are speaking to an AI assistant and that calls may be recorded.",
    };
  }

  const businessHours = serializeBusinessHours(payload.openingHoursSchedule, {
    open24_7: payload.open24_7,
    bankHolidays: payload.bankHolidays,
  });

  const { error } = await admin
    .from("organizations")
    .update({
      name: payload.name.trim(),
      assistant_display_name: payload.assistantDisplayName.trim() || "Cara",
      agent_voice_id: payload.agentVoiceId.trim() || null,
      greeting,
      agent_business_type: payload.agentBusinessType.trim() || null,
      business_knowledge_summary:
        payload.businessKnowledgeSummary.trim() || null,
      agent_extra_notes: payload.agentExtraNotes.trim() || null,
      agent_location_address: payload.agentLocationAddress.trim() || null,
      agent_location_eircode: payload.agentLocationEircode.trim() || null,
      agent_location_county: payload.agentLocationCounty.trim() || null,
      agent_base_town: payload.agentBaseTown.trim() || null,
      agent_services_departments:
        payload.agentServicesDepartments.trim() || null,
      agent_services_not_offered:
        payload.agentServicesNotOffered.trim() || null,
      agent_business_rules: payload.agentBusinessRules,
      agent_cara_rules: payload.agentCaraRules,
      agent_cara_conduct: payload.agentCaraConduct.trim() || null,
      agent_faqs: payload.agentFaqs,
      quote_prices_on_calls: payload.quotePricesOnCalls,
      block_anonymous_callers: payload.blockAnonymousCallers,
      business_hours: businessHours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };

  const regen = await regenerateCaraCustomPrompt(admin, organizationId);
  if (!regen.ok) return regen;

  revalidateAll(organizationId);
  return { ok: true };
}
