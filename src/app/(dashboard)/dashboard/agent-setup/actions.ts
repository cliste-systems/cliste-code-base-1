"use server";

import { revalidatePath } from "next/cache";

import { compactEircode, normalizeIrelandLocationQuery } from "@/lib/geocode-ireland";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { auditVoiceGreetingSecurityEvent } from "@/lib/voice-greeting-audit";
import { sanitizeGreetingLine } from "@/lib/voice-greeting-security";
import {
  cleanBusinessRules,
  MAX_BUSINESS_RULES,
} from "@/lib/agent-business-rules";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";
import {
  serializeBusinessHours,
  weekScheduleHasOpenDay,
  type WeekSchedule,
} from "@/lib/business-hours";
import {
  ensureCompliantStoredGreeting,
  greetingMissingDisclosure,
} from "@/lib/general-boundary";
import {
  buildFullVoiceGreeting,
  defaultVoiceGreetingIntro,
  VOICE_ASSISTANT_DEFAULT_NAME,
} from "@/lib/voice-greeting";
import { validateVoiceGreetingGuardrails } from "@/lib/voice-greeting-guardrails";

import { cleanAgentFaqs, type AgentFaq } from "./agent-faqs";

export type AgentSetupPayload = {
  assistantDisplayName: string;
  greetingIntro: string;
  greetingClosing: string;
  faqs: AgentFaq[];
  openingHours: string;
  businessHours: WeekSchedule;
  open24_7: boolean;
  hoursNote: string;
  serviceArea: string;
  serviceAreaExclusions: string;
  servicesDepartments: string;
  servicesNotOffered: string;
  detailsToCollect: string;
  businessRules: string[];
  locationAddress: string;
  locationEircode: string;
};

type SaveResult = { ok: true } | { ok: false; message: string };

const MAX_GREETING = 500;
const MAX_ASSISTANT_NAME = 64;
const MAX_HOURS = 2000;
const MAX_SERVICE_AREA = 2000;
const MAX_SERVICES_DEPARTMENTS = 2000;
const MAX_SERVICES_NOT_OFFERED = 2000;
const MAX_DETAILS_TO_COLLECT = 2000;
const MAX_LOCATION_ADDRESS = 500;
const MAX_EIRCODE = 16;

const CARA_SETUP_PATHS = [
  "/dashboard/cara-setup",
  "/dashboard/cara-setup/general",
  "/dashboard/cara-setup/services",
  "/dashboard/cara-setup/call-handling",
  "/dashboard/cara-setup/answers",
  "/dashboard/agent-setup",
] as const;

function revalidateCaraSetup() {
  for (const path of CARA_SETUP_PATHS) {
    revalidatePath(path);
  }
}

/**
 * Save the agent configuration. `custom_prompt` is always compiled from
 * structured fields via {@link regenerateCaraCustomPrompt}.
 */
export async function saveAgentSetup(payload: AgentSetupPayload): Promise<SaveResult> {
  const { supabase, organizationId, user } = await requireDashboardSession();

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle<{ name: string }>();

  const businessName = orgRow?.name ?? "";
  const assistantDisplayName = VOICE_ASSISTANT_DEFAULT_NAME;
  const greetingIntro =
    sanitizeGreetingLine(String(payload?.greetingIntro ?? "")) ||
    defaultVoiceGreetingIntro(businessName);
  const greetingClosing = sanitizeGreetingLine(
    String(payload?.greetingClosing ?? ""),
  );
  const guardrail = validateVoiceGreetingGuardrails({
    greetingIntro,
    greetingClosing,
    businessName,
  });
  if (!guardrail.ok) {
    void auditVoiceGreetingSecurityEvent({
      source: "agent_setup",
      outcome: "failure",
      actorUserId: user.id,
      organizationId,
      eventType: "voice_greeting_guardrail_blocked",
      introIssue: guardrail.introIssue,
      closingIssue: guardrail.closingIssue,
      introLength: greetingIntro.length,
    });
    return { ok: false, message: guardrail.message };
  }

  const greetingAssembled = buildFullVoiceGreeting(
    greetingIntro,
    assistantDisplayName,
    greetingClosing,
  );
  if (greetingMissingDisclosure(greetingAssembled, assistantDisplayName)) {
    return {
      ok: false,
      message:
        "Callers must be told they're speaking to an AI and that calls may be recorded — we've kept that part in.",
    };
  }
  const greeting = ensureCompliantStoredGreeting({
    greeting: greetingAssembled,
    businessName,
    assistantDisplayName,
  });

  const businessHours = payload.businessHours;
  const open24_7 = payload.open24_7 === true;
  const hoursNote = String(payload?.hoursNote ?? "").trim().slice(0, 120);
  const openingHours = open24_7
    ? "Open 24 hours, 7 days a week"
    : weekScheduleHasOpenDay(businessHours)
      ? formatWeekScheduleForAgent(businessHours)
      : "Closed all week";
  const serviceArea = String(payload?.serviceArea ?? "").trim();
  const serviceAreaExclusions = String(payload?.serviceAreaExclusions ?? "").trim();
  const servicesDepartments = String(payload?.servicesDepartments ?? "").trim();
  const servicesNotOffered = String(payload?.servicesNotOffered ?? "").trim();
  const detailsToCollect = String(payload?.detailsToCollect ?? "").trim();
  const businessRules = cleanBusinessRules(payload?.businessRules);
  const locationAddress = String(payload?.locationAddress ?? "").trim();
  let locationEircode = String(payload?.locationEircode ?? "").trim();
  const faqs = cleanAgentFaqs(payload?.faqs);

  if (locationEircode) {
    locationEircode = normalizeIrelandLocationQuery(locationEircode);
    if (!compactEircode(locationEircode)) {
      return {
        ok: false,
        message: "Enter a valid Eircode (e.g. D06 X2P6), or leave it blank.",
      };
    }
  }

  if (assistantDisplayName.length > MAX_ASSISTANT_NAME) {
    return { ok: false, message: "Caller-facing name is too long." };
  }
  if (greeting.length > MAX_GREETING) {
    return { ok: false, message: `Greeting is too long (max ${MAX_GREETING}).` };
  }
  if (openingHours.length > MAX_HOURS) {
    return { ok: false, message: "Opening hours text is too long." };
  }
  if (serviceArea.length > MAX_SERVICE_AREA) {
    return { ok: false, message: "Service area text is too long." };
  }
  if (serviceAreaExclusions.length > MAX_SERVICE_AREA) {
    return { ok: false, message: "Town exclusions text is too long." };
  }
  if (servicesDepartments.length > MAX_SERVICES_DEPARTMENTS) {
    return { ok: false, message: "Services and departments text is too long." };
  }
  if (servicesNotOffered.length > MAX_SERVICES_NOT_OFFERED) {
    return { ok: false, message: "What you don't offer text is too long." };
  }
  if (detailsToCollect.length > MAX_DETAILS_TO_COLLECT) {
    return { ok: false, message: "Details to collect text is too long." };
  }
  if (businessRules.length > MAX_BUSINESS_RULES) {
    return {
      ok: false,
      message: `Too many rules (max ${MAX_BUSINESS_RULES}).`,
    };
  }
  if (locationAddress.length > MAX_LOCATION_ADDRESS) {
    return { ok: false, message: "Location address is too long." };
  }
  if (locationEircode.length > MAX_EIRCODE) {
    return { ok: false, message: "Eircode looks too long." };
  }

  const update: Record<string, unknown> = {
    assistant_display_name: assistantDisplayName,
    greeting,
    agent_faqs: faqs,
    agent_opening_hours: openingHours || null,
    business_hours: serializeBusinessHours(businessHours, {
      open24_7,
      hoursNote,
    }),
    agent_service_area: serviceArea || null,
    agent_service_area_exclusions: serviceAreaExclusions || null,
    agent_services_departments: servicesDepartments || null,
    agent_services_not_offered: servicesNotOffered || null,
    agent_details_to_collect: detailsToCollect || null,
    agent_business_rules: businessRules,
    agent_location_address: locationAddress || null,
    agent_location_eircode: locationEircode || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };

  await regenerateCaraCustomPrompt(supabase, organizationId);

  revalidateCaraSetup();
  return { ok: true };
}
