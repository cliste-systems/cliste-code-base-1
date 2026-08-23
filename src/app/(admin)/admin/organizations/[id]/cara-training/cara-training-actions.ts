"use server";

import { revalidatePath } from "next/cache";

import { parseAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  composeAdminGreeting,
  parseAdminGreetingParts,
} from "@/lib/admin-store-readiness";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import { parseAgentCaraRules } from "@/lib/agent-cara-rules";
import { parseCallRoutingMode, type CallRoutingMode } from "@/lib/call-routing";
import {
  adminCaraTrainingSectionChecks,
  type AdminCaraTrainingReadinessInput,
} from "@/lib/admin-cara-training-readiness";
import {
  defaultBankHolidayConfig,
  emptyWeekSchedule,
  isBusinessHoursUnset,
  parseBusinessHoursBundle,
  serializeBusinessHours,
  type BankHolidayConfig,
  type WeekSchedule,
} from "@/lib/business-hours";
import { loadBusinessHoursOverrides } from "@/lib/business-hours-overrides";
import { parseDetailsCollectMode, type DetailsCollectMode } from "@/lib/details-collect-mode";
import { greetingDisclosesAi } from "@/lib/greeting-discloses-ai";
import {
  buildRetailPromptExtras,
  loadStoreDepartments,
  loadStorePhoneSystem,
} from "@/lib/load-store-phone-system";
import {
  listElevenLabsVoices,
  resolveElevenLabsVoiceName,
} from "@/lib/elevenlabs-voice";
import { countDepartmentsWithTransferTargets } from "@/lib/store-departments";
import {
  finalizeCaraTrainingSave,
  syncStoreDepartmentsToOrg,
} from "@/lib/sync-store-departments";
import type {
  StoreContactRow,
  StoreDepartmentRow,
} from "@/lib/retail-store-types";
import type {
  StorePhoneSystemRow,
  StoreTransferMethod,
  WarmTransferHardwareStatus,
} from "@/lib/store-transfer-capability";
import { requireAdminSessionUser } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
import { AGENT_CONFIG_REVALIDATE_PATHS } from "@/lib/dashboard-routes";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ActionResult = { ok: true } | { ok: false; message: string };

export type BusinessHoursOverrideDraft = {
  id: string;
  label: string;
  schedule: WeekSchedule;
  expiresAt: string;
};

export type CaraTrainingGapItem = {
  id: string;
  gapKind: "learnable" | "live_info";
  gapSummary: string;
  caraQuestion: string;
  occurrenceCount: number;
  lastSeenAt: string;
  status: string;
};

export type CaraTrainingData = {
  organizationId: string;
  name: string;
  assistantDisplayName: string;
  greetingIntro: string;
  greetingClosing: string;
  agentVoiceId: string;
  resolvedVoiceName: string | null;
  agentBusinessType: string;
  businessKnowledgeSummary: string;
  agentLocationAddress: string;
  agentLocationEircode: string;
  agentLocationCounty: string;
  agentBaseTown: string;
  agentServicesNotOffered: string;
  agentExtraNotes: string;
  agentBusinessRules: string[];
  agentCaraRules: string[];
  agentCaraConduct: string;
  agentFaqs: { question: string; answer: string }[];
  quotePricesOnCalls: boolean;
  blockAnonymousCallers: boolean;
  openingHoursSchedule: WeekSchedule;
  open24_7: boolean;
  bankHolidays: BankHolidayConfig;
  hoursOverrides: BusinessHoursOverrideDraft[];
  departments: StoreDepartmentRow[];
  contacts: StoreContactRow[];
  callRoutingMode: CallRoutingMode;
  phoneSystem: StorePhoneSystemRow | null;
  canTransfer: boolean;
  departmentsWithTransferTargets: number;
  agentDetailsToCollect: string;
  detailsCollectMode: DetailsCollectMode;
  trainingGaps: CaraTrainingGapItem[];
  adminNotes: string;
  customPrompt: string;
  promptCompileWarnings: unknown[];
  sectionChecks: ReturnType<typeof adminCaraTrainingSectionChecks>;
};

function revalidateAll(orgId: string) {
  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath(`/admin/organizations/${orgId}/cara-training`);
  revalidatePath(`/admin/customers/${orgId}`);
  revalidatePath(`/admin/customers/${orgId}/cara-training`);
  revalidatePath("/admin/customers");
  for (const path of AGENT_CONFIG_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

async function adminClient() {
  await requireAdminSessionUser();
  return createAdminClient();
}

function readinessInputFromData(
  data: Partial<CaraTrainingData> & Pick<CaraTrainingData, "organizationId">,
): AdminCaraTrainingReadinessInput {
  return {
    assistantDisplayName: data.assistantDisplayName ?? "",
    agentVoiceId: data.agentVoiceId ?? "",
    greetingIntro: data.greetingIntro ?? "",
    greetingClosing: data.greetingClosing ?? "",
    agentBusinessType: data.agentBusinessType ?? "",
    businessKnowledgeSummary: data.businessKnowledgeSummary ?? "",
    departments: data.departments ?? [],
    agentServicesNotOffered: data.agentServicesNotOffered ?? "",
    agentExtraNotes: data.agentExtraNotes ?? "",
    businessHours: data.openingHoursSchedule
      ? serializeBusinessHours(data.openingHoursSchedule, {
          open24_7: data.open24_7,
          bankHolidays: data.bankHolidays,
        })
      : null,
    agentFaqs: data.agentFaqs ?? [],
    agentDetailsToCollect: data.agentDetailsToCollect ?? "",
    phoneSystem: data.phoneSystem ?? null,
    canTransfer: data.canTransfer ?? false,
    quotePricesOnCalls: data.quotePricesOnCalls,
    customPrompt: data.customPrompt ?? "",
    promptCompileWarnings: data.promptCompileWarnings ?? [],
  };
}

export async function loadCaraTrainingData(
  organizationId: string,
): Promise<CaraTrainingData | null> {
  if (!UUID_RE.test(organizationId)) return null;
  const admin = await adminClient();

  const ORG_SELECT_FULL =
    "id, name, greeting, custom_prompt, prompt_compile_warnings, assistant_display_name, agent_voice_id, agent_business_type, business_knowledge_summary, agent_extra_notes, agent_location_address, agent_location_eircode, agent_location_county, agent_base_town, agent_services_not_offered, agent_business_rules, agent_cara_rules, agent_cara_conduct, agent_faqs, quote_prices_on_calls, block_anonymous_callers, business_hours, call_routing_mode, agent_details_to_collect, agent_details_collect_mode, admin_notes";
  const ORG_SELECT_LEGACY = ORG_SELECT_FULL.replace(", admin_notes", "");

  let orgResult = await admin
    .from("organizations")
    .select(ORG_SELECT_FULL)
    .eq("id", organizationId)
    .maybeSingle();

  if (orgResult.error?.message && /admin_notes|schema cache|column/i.test(orgResult.error.message)) {
    orgResult = await admin
      .from("organizations")
      .select(ORG_SELECT_LEGACY)
      .eq("id", organizationId)
      .maybeSingle();
  }

  const org = orgResult.data;
  if (orgResult.error && !org?.id) return null;
  if (!org?.id) return null;

  const gapsWithKind = await admin
    .from("cara_training_items")
    .select(
      "id, gap_kind, gap_summary, cara_question, occurrence_count, last_seen_at, status",
    )
    .eq("organization_id", organizationId)
    .in("status", ["awaiting_answer", "draft_ready"])
    .order("occurrence_count", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(50);

  const gapsResult =
    gapsWithKind.error &&
    /gap_kind|schema cache|column/i.test(gapsWithKind.error.message)
      ? await admin
          .from("cara_training_items")
          .select(
            "id, gap_summary, cara_question, occurrence_count, last_seen_at, status",
          )
          .eq("organization_id", organizationId)
          .in("status", ["awaiting_answer", "draft_ready"])
          .order("occurrence_count", { ascending: false })
          .order("last_seen_at", { ascending: false })
          .limit(50)
      : gapsWithKind;

  const [
    departments,
    contactsResult,
    phoneSystem,
    hoursOverrides,
    voices,
  ] = await Promise.all([
    loadStoreDepartments(admin, organizationId),
    admin
      .from("store_contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true }),
    loadStorePhoneSystem(admin, organizationId),
    loadBusinessHoursOverrides(admin, organizationId),
    listElevenLabsVoices(),
  ]);

  const callRoutingMode = parseCallRoutingMode(org.call_routing_mode);
  const retailExtras = buildRetailPromptExtras({
    callRoutingMode,
    phoneSystem,
    departments,
  });

  const hoursUnset = isBusinessHoursUnset(org.business_hours);
  const { schedule, meta } = hoursUnset
    ? { schedule: emptyWeekSchedule(), meta: { open24_7: false, bankHolidays: defaultBankHolidayConfig() } }
    : parseBusinessHoursBundle(org.business_hours);

  const parts = parseAdminGreetingParts({
    organizationId,
    name: String(org.name ?? ""),
    slug: "",
    niche: "retail",
    accountId: null,
    storeCode: "",
    retailBanner: "",
    agentLocationAddress: String(org.agent_location_address ?? ""),
    agentLocationEircode: String(org.agent_location_eircode ?? ""),
    agentLocationCounty: String(org.agent_location_county ?? ""),
    timezone: "",
    phoneNumber: "",
    storePublicNumber: "",
    callRoutingMode,
    fallbackNumber: "",
    divertCarrier: "",
    divertVerifiedAt: null,
    retailFacilities: [],
    retailDelivery: {},
    retailClickCollectUrl: "",
    retailLoyaltyProgram: "",
    quotePricesOnCalls: org.quote_prices_on_calls === true,
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

  const agentVoiceId = String(org.agent_voice_id ?? "");
  const agentFaqs = parseAgentFaqs(org.agent_faqs).map((f) => ({
    question: f.question,
    answer: f.answer,
  }));

  const data: CaraTrainingData = {
    organizationId,
    name: String(org.name ?? ""),
    assistantDisplayName: String(org.assistant_display_name ?? "Cara"),
    greetingIntro: parts.intro,
    greetingClosing: parts.closing,
    agentVoiceId,
    resolvedVoiceName: resolveElevenLabsVoiceName(agentVoiceId, voices),
    agentBusinessType: String(org.agent_business_type ?? ""),
    businessKnowledgeSummary: String(org.business_knowledge_summary ?? ""),
    agentLocationAddress: String(org.agent_location_address ?? ""),
    agentLocationEircode: String(org.agent_location_eircode ?? ""),
    agentLocationCounty: String(org.agent_location_county ?? ""),
    agentBaseTown: String(org.agent_base_town ?? ""),
    agentServicesNotOffered: String(org.agent_services_not_offered ?? ""),
    agentExtraNotes: String(org.agent_extra_notes ?? ""),
    agentBusinessRules: parseAgentBusinessRules(org.agent_business_rules),
    agentCaraRules: parseAgentCaraRules(org.agent_cara_rules),
    agentCaraConduct: String(org.agent_cara_conduct ?? ""),
    agentFaqs,
    quotePricesOnCalls: org.quote_prices_on_calls === true,
    blockAnonymousCallers: org.block_anonymous_callers === true,
    openingHoursSchedule: schedule,
    open24_7: meta.open24_7 === true,
    bankHolidays: meta.bankHolidays ?? defaultBankHolidayConfig(),
    hoursOverrides: hoursOverrides.map((row) => ({
      id: row.id,
      label: row.label,
      schedule: row.schedule,
      expiresAt: row.expires_at,
    })),
    departments,
    contacts: (contactsResult.data ?? []) as StoreContactRow[],
    callRoutingMode,
    phoneSystem,
    canTransfer: retailExtras.canTransfer,
    departmentsWithTransferTargets: countDepartmentsWithTransferTargets(departments),
    agentDetailsToCollect: String(org.agent_details_to_collect ?? ""),
    detailsCollectMode: parseDetailsCollectMode(org.agent_details_collect_mode),
    trainingGaps: (gapsResult.data ?? []).map((g) => ({
      id: String(g.id),
      gapKind: (g.gap_kind === "live_info" ? "live_info" : "learnable") as
        | "learnable"
        | "live_info",
      gapSummary: String(g.gap_summary ?? ""),
      caraQuestion: String(g.cara_question ?? ""),
      occurrenceCount: Number(g.occurrence_count ?? 1),
      lastSeenAt: String(g.last_seen_at ?? ""),
      status: String(g.status ?? ""),
    })),
    adminNotes: String(org.admin_notes ?? ""),
    customPrompt: String(org.custom_prompt ?? ""),
    promptCompileWarnings: Array.isArray(org.prompt_compile_warnings)
      ? org.prompt_compile_warnings
      : [],
    sectionChecks: [],
  };

  data.sectionChecks = adminCaraTrainingSectionChecks(readinessInputFromData(data));
  return data;
}

async function validateVoiceId(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  voiceId: string,
): Promise<ActionResult | { ok: true; voiceName: string | null }> {
  const trimmed = voiceId.trim();
  if (!trimmed) return { ok: false, message: "Voice ID is required." };
  const voices = await listElevenLabsVoices();
  if (voices.length === 0) return { ok: true, voiceName: null };
  const name = resolveElevenLabsVoiceName(trimmed, voices);
  if (!name) {
    return { ok: false, message: "Unknown ElevenLabs voice ID." };
  }
  return { ok: true, voiceName: name };
}

export async function saveCaraTrainingIdentity(
  organizationId: string,
  payload: {
    assistantDisplayName: string;
    greetingIntro: string;
    greetingClosing: string;
    agentVoiceId: string;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  const admin = await adminClient();

  const voiceCheck = await validateVoiceId(admin, payload.agentVoiceId);
  if (!voiceCheck.ok) return voiceCheck;

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();

  const greeting = composeAdminGreeting(
    {
      organizationId,
      name: String(org?.name ?? ""),
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
      greeting: "",
      customPrompt: "",
      promptCompileWarnings: [],
      assistantDisplayName: payload.assistantDisplayName,
      agentVoiceId: payload.agentVoiceId,
      isActive: false,
      caraOnlineSince: null,
      businessHours: null,
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

  const { error } = await admin
    .from("organizations")
    .update({
      assistant_display_name: payload.assistantDisplayName.trim() || "Cara",
      agent_voice_id: payload.agentVoiceId.trim() || null,
      greeting,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  return finalizeCaraTrainingSave(admin, organizationId);
}

export async function saveCaraTrainingStoreFacts(
  organizationId: string,
  payload: {
    agentBusinessType: string;
    businessKnowledgeSummary: string;
    agentLocationAddress: string;
    agentLocationEircode: string;
    agentLocationCounty: string;
    agentBaseTown: string;
    openingHoursSchedule: WeekSchedule;
    open24_7: boolean;
    bankHolidays: BankHolidayConfig;
    hoursOverrides: BusinessHoursOverrideDraft[];
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  const admin = await adminClient();

  const businessHours = serializeBusinessHours(payload.openingHoursSchedule, {
    open24_7: payload.open24_7,
    bankHolidays: payload.bankHolidays,
  });

  const { error } = await admin
    .from("organizations")
    .update({
      agent_business_type: payload.agentBusinessType.trim() || null,
      business_knowledge_summary: payload.businessKnowledgeSummary.trim() || null,
      agent_location_address: payload.agentLocationAddress.trim() || null,
      agent_location_eircode: payload.agentLocationEircode.trim() || null,
      agent_location_county: payload.agentLocationCounty.trim() || null,
      agent_base_town: payload.agentBaseTown.trim() || null,
      business_hours: businessHours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };

  await admin
    .from("business_hours_overrides")
    .delete()
    .eq("organization_id", organizationId);

  const validOverrides = payload.hoursOverrides.filter(
    (o) => o.label.trim() && o.expiresAt,
  );
  if (validOverrides.length > 0) {
    const { error: overrideErr } = await admin
      .from("business_hours_overrides")
      .insert(
        validOverrides.map((o) => ({
          organization_id: organizationId,
          label: o.label.trim(),
          schedule: serializeBusinessHours(o.schedule, {}),
          expires_at: o.expiresAt,
        })),
      );
    if (overrideErr) return { ok: false, message: overrideErr.message };
  }

  return finalizeCaraTrainingSave(admin, organizationId);
}

export async function saveCaraTrainingDepartments(
  organizationId: string,
  departments: Omit<StoreDepartmentRow, "organization_id">[],
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  const admin = await adminClient();

  const { data: existing } = await admin
    .from("store_departments")
    .select("id")
    .eq("organization_id", organizationId);

  const existingIds = new Set((existing ?? []).map((d) => String(d.id)));
  const keptIds = new Set<string>();

  for (const [index, dept] of departments.entries()) {
    const row = {
      organization_id: organizationId,
      name: dept.name.trim(),
      phone_e164: dept.phone_e164?.trim() || null,
      extension: dept.extension?.trim() || null,
      hours: dept.hours,
      transfer_enabled: dept.transfer_enabled,
      cara_note: dept.cara_note?.trim() || null,
      handles_text: dept.handles_text?.trim() || null,
      is_off_licence: dept.is_off_licence,
      is_an_post: dept.is_an_post,
      sort_order: index,
      active: dept.active,
      updated_at: new Date().toISOString(),
    };

    if (dept.id && existingIds.has(dept.id)) {
      keptIds.add(dept.id);
      const { error } = await admin
        .from("store_departments")
        .update(row)
        .eq("id", dept.id)
        .eq("organization_id", organizationId);
      if (error) return { ok: false, message: error.message };
    } else {
      const { error } = await admin.from("store_departments").insert(row);
      if (error) return { ok: false, message: error.message };
    }
  }

  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await admin
      .from("store_departments")
      .delete()
      .in("id", toDelete)
      .eq("organization_id", organizationId);
    if (error) return { ok: false, message: error.message };
  }

  const sync = await syncStoreDepartmentsToOrg(admin, organizationId);
  if (!sync.ok) return sync;
  return finalizeCaraTrainingSave(admin, organizationId);
}

export async function saveCaraTrainingContacts(
  organizationId: string,
  contacts: Omit<StoreContactRow, "organization_id">[],
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  const admin = await adminClient();

  const { data: existing } = await admin
    .from("store_contacts")
    .select("id")
    .eq("organization_id", organizationId);

  const existingIds = new Set((existing ?? []).map((c) => String(c.id)));
  const keptIds = new Set<string>();

  for (const contact of contacts) {
    const row = {
      organization_id: organizationId,
      department_id: contact.department_id,
      name: contact.name.trim(),
      role: contact.role,
      phone_e164: contact.phone_e164?.trim() || null,
      email: contact.email?.trim() || null,
      is_notification_target: contact.is_notification_target,
      can_receive_transfers: contact.can_receive_transfers,
      active: contact.active,
      updated_at: new Date().toISOString(),
    };

    if (contact.id && existingIds.has(contact.id)) {
      keptIds.add(contact.id);
      const { error } = await admin
        .from("store_contacts")
        .update(row)
        .eq("id", contact.id)
        .eq("organization_id", organizationId);
      if (error) return { ok: false, message: error.message };
    } else {
      const { error } = await admin.from("store_contacts").insert(row);
      if (error) return { ok: false, message: error.message };
    }
  }

  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await admin
      .from("store_contacts")
      .delete()
      .in("id", toDelete)
      .eq("organization_id", organizationId);
    if (error) return { ok: false, message: error.message };
  }

  return finalizeCaraTrainingSave(admin, organizationId);
}

export async function saveCaraTrainingPhoneSystem(
  organizationId: string,
  payload: {
    systemType: string;
    vendor: string;
    handsetCount: number | null;
    transferMethod: StoreTransferMethod;
    warmTransferHardwareStatus: WarmTransferHardwareStatus;
    mainLineE164: string;
    notes: string;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  const admin = await adminClient();

  const row = {
    organization_id: organizationId,
    system_type: payload.systemType,
    vendor: payload.vendor.trim() || null,
    handset_count: payload.handsetCount,
    transfer_method: payload.transferMethod,
    warm_transfer_hardware_status: payload.warmTransferHardwareStatus,
    main_line_e164: payload.mainLineE164.trim() || null,
    notes: payload.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("store_phone_systems").upsert(row);
  if (error) return { ok: false, message: error.message };
  return finalizeCaraTrainingSave(admin, organizationId);
}

export async function saveCaraTrainingBoundaries(
  organizationId: string,
  payload: {
    agentServicesNotOffered: string;
    agentExtraNotes: string;
    agentBusinessRules: string[];
    agentCaraRules: string[];
    agentCaraConduct: string;
    quotePricesOnCalls: boolean;
    blockAnonymousCallers: boolean;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  const admin = await adminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      agent_services_not_offered: payload.agentServicesNotOffered.trim() || null,
      agent_extra_notes: payload.agentExtraNotes.trim() || null,
      agent_business_rules: payload.agentBusinessRules,
      agent_cara_rules: payload.agentCaraRules,
      agent_cara_conduct: payload.agentCaraConduct.trim() || null,
      quote_prices_on_calls: payload.quotePricesOnCalls,
      block_anonymous_callers: payload.blockAnonymousCallers,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  return finalizeCaraTrainingSave(admin, organizationId);
}

export async function saveCaraTrainingFaqs(
  organizationId: string,
  faqs: { question: string; answer: string }[],
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  const admin = await adminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      agent_faqs: faqs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  return finalizeCaraTrainingSave(admin, organizationId);
}

export async function saveCaraTrainingFallback(
  organizationId: string,
  payload: {
    agentDetailsToCollect: string;
    detailsCollectMode: DetailsCollectMode;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  const admin = await adminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      agent_details_to_collect: payload.agentDetailsToCollect.trim() || null,
      agent_details_collect_mode: payload.detailsCollectMode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  return finalizeCaraTrainingSave(admin, organizationId);
}

export async function saveCaraTrainingAdminNotes(
  organizationId: string,
  adminNotes: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  const admin = await adminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      admin_notes: adminNotes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };
  revalidateAll(organizationId);
  return { ok: true };
}

/** Reload compiled prompt after save — client calls after section saves. */
export async function reloadCaraTrainingPrompt(
  organizationId: string,
): Promise<
  | { ok: true; customPrompt: string; promptCompileWarnings: unknown[]; sectionChecks: ReturnType<typeof adminCaraTrainingSectionChecks> }
  | { ok: false; message: string }
> {
  if (!UUID_RE.test(organizationId)) {
    return { ok: false, message: "Invalid organization id." };
  }
  const data = await loadCaraTrainingData(organizationId);
  if (!data) return { ok: false, message: "Organization not found." };
  return {
    ok: true,
    customPrompt: data.customPrompt,
    promptCompileWarnings: data.promptCompileWarnings,
    sectionChecks: data.sectionChecks,
  };
}

/** @deprecated Use section-specific save actions. Kept for legacy callers. */
export async function saveCaraTraining(
  organizationId: string,
  payload: {
    name: string;
    assistantDisplayName: string;
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
  },
): Promise<ActionResult> {
  const identity = await saveCaraTrainingIdentity(organizationId, {
    assistantDisplayName: payload.assistantDisplayName,
    greetingIntro: payload.greetingIntro,
    greetingClosing: payload.greetingClosing,
    agentVoiceId: payload.agentVoiceId,
  });
  if (!identity.ok) return identity;

  const facts = await saveCaraTrainingStoreFacts(organizationId, {
    agentBusinessType: payload.agentBusinessType,
    businessKnowledgeSummary: payload.businessKnowledgeSummary,
    agentLocationAddress: payload.agentLocationAddress,
    agentLocationEircode: payload.agentLocationEircode,
    agentLocationCounty: payload.agentLocationCounty,
    agentBaseTown: payload.agentBaseTown,
    openingHoursSchedule: payload.openingHoursSchedule,
    open24_7: payload.open24_7,
    bankHolidays: payload.bankHolidays,
    hoursOverrides: [],
  });
  if (!facts.ok) return facts;

  const boundaries = await saveCaraTrainingBoundaries(organizationId, {
    agentServicesNotOffered: payload.agentServicesNotOffered,
    agentExtraNotes: payload.agentExtraNotes,
    agentBusinessRules: payload.agentBusinessRules,
    agentCaraRules: payload.agentCaraRules,
    agentCaraConduct: payload.agentCaraConduct,
    quotePricesOnCalls: payload.quotePricesOnCalls,
    blockAnonymousCallers: payload.blockAnonymousCallers,
  });
  if (!boundaries.ok) return boundaries;

  return saveCaraTrainingFaqs(organizationId, payload.agentFaqs);
}

export { parseAgentKnowledgeList };
