import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatExtraNotesForStorage } from "@/app/(onboarding)/onboarding/knowledge/train-cara-trade-topics";
import { cleanAgentFaqs, type AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { MAX_DESCRIPTION, MAX_SUMMARY } from "@/lib/business-knowledge-summary";
import type { OnboardingUiCopy } from "@/lib/onboarding-ui-copy-shared";
import {
  cleanBusinessRules,
  stitchBusinessRulesIntoSummary,
} from "@/lib/agent-business-rules";
import {
  cleanCaptureFields,
  defaultCaptureFieldsForBusinessType,
  type CaraCaptureField,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";

export type BusinessKnowledgePayload = {
  rawBusinessDescription?: string;
  businessKnowledgeSummary?: string;
  openingHours: string;
  serviceArea: string;
  servicesOffered?: string;
  emergencyCallouts?: string;
  extraNotes?: string;
  refinedBusinessType?: string;
  /** When true, agent_faqs is not updated (know step). */
  preserveFaqs?: boolean;
  faqs: AgentFaq[];
  onboardingUiCopy?: OnboardingUiCopy | null;
  captureFields?: CaraCaptureField[];
  businessRules?: string[];
};

type SaveResult = { ok: true } | { ok: false; message: string };

const MAX_HOURS = 2000;
const MAX_SERVICE_AREA = 2000;
const MAX_EXTRA_NOTES = 2000;
const MAX_SERVICES = 2000;
const MAX_BUSINESS_TYPE = 200;

export async function persistBusinessKnowledge(
  supabase: SupabaseClient,
  organizationId: string,
  payload: BusinessKnowledgePayload,
): Promise<SaveResult> {
  const rawDescription = String(payload.rawBusinessDescription ?? "").trim();
  const openingHours = String(payload.openingHours ?? "").trim();
  const serviceArea = String(payload.serviceArea ?? "").trim();
  const servicesOffered = String(payload.servicesOffered ?? "").trim();
  const emergencyCallouts = String(payload.emergencyCallouts ?? "").trim();
  const extraNotes = formatExtraNotesForStorage({
    extraNotes: String(payload.extraNotes ?? "").trim(),
    emergencyCallouts,
  });
  const refinedBusinessType = String(payload.refinedBusinessType ?? "").trim();
  const faqs = cleanAgentFaqs(payload.faqs);
  const businessRules =
    payload.businessRules !== undefined
      ? cleanBusinessRules(payload.businessRules)
      : undefined;
  const summaryBase = String(payload.businessKnowledgeSummary ?? "").trim();
  const knowledgeSummary =
    businessRules !== undefined
      ? stitchBusinessRulesIntoSummary(summaryBase, businessRules)
      : summaryBase;
  const captureFields = cleanCaptureFields(payload.captureFields ?? []);

  if (rawDescription.length > MAX_DESCRIPTION) {
    return { ok: false, message: "Business description is too long." };
  }
  if (knowledgeSummary.length > MAX_SUMMARY) {
    return { ok: false, message: "Cara's notes are too long." };
  }
  if (openingHours.length > MAX_HOURS) {
    return { ok: false, message: "Opening hours text is too long." };
  }
  if (serviceArea.length > MAX_SERVICE_AREA) {
    return { ok: false, message: "Service area text is too long." };
  }
  if (servicesOffered.length > MAX_SERVICES) {
    return { ok: false, message: "Services text is too long." };
  }
  if (extraNotes.length > MAX_EXTRA_NOTES) {
    return { ok: false, message: "Extra notes text is too long." };
  }
  if (refinedBusinessType.length > MAX_BUSINESS_TYPE) {
    return { ok: false, message: "Business type text is too long." };
  }

  const update: Record<string, unknown> = {
    raw_business_description: rawDescription || null,
    business_knowledge_summary: knowledgeSummary || null,
    agent_opening_hours: openingHours || null,
    agent_service_area: serviceArea || null,
    agent_services_departments: servicesOffered || null,
    agent_extra_notes: extraNotes || null,
    updated_at: new Date().toISOString(),
  };

  if (!payload.preserveFaqs) {
    update.agent_faqs = faqs;
  }

  if (refinedBusinessType) {
    const { data: existing } = await supabase
      .from("organizations")
      .select("agent_business_type")
      .eq("id", organizationId)
      .maybeSingle();

    const current = String(existing?.agent_business_type ?? "").trim();
    if (!current) {
      update.agent_business_type = refinedBusinessType;
    }
  }

  if (payload.onboardingUiCopy !== undefined) {
    update.onboarding_ui_copy = payload.onboardingUiCopy;
  }

  if (payload.captureFields !== undefined) {
    update.agent_capture_fields = captureFields;
  } else if (payload.businessRules !== undefined) {
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("agent_business_type, agent_capture_fields")
      .eq("id", organizationId)
      .maybeSingle();

    const existingCapture = cleanCaptureFields(existingOrg?.agent_capture_fields ?? []);
    if (existingCapture.length === 0) {
      const businessType =
        refinedBusinessType ||
        String(existingOrg?.agent_business_type ?? "").trim();
      update.agent_capture_fields = defaultCaptureFieldsForBusinessType(businessType);
    }
  }

  if (payload.businessRules !== undefined) {
    update.agent_business_rules = businessRules;
  }

  const { error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", organizationId);

  if (error) return { ok: false, message: error.message };

  return { ok: true };
}
