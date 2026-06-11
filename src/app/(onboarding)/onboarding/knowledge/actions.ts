"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  routesFromStoredLinks,
  serializeRoutes,
  validateRoutes,
  type SavedRoute,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import { normalizeRoutingLink } from "@/app/(dashboard)/dashboard/routing/routing-owner-copy";
import { parseRoutingLinks } from "@/app/(dashboard)/dashboard/routing/routing-links";
import {
  generateCaraBusinessNotes,
  type CaraKnowledgeExtraction,
} from "@/lib/business-knowledge-summary";
import {
  generateOnboardingUiCopy,
  type OnboardingUiCopy,
} from "@/lib/onboarding-ui-copy";
import {
  processCaraKnowledgeTurn,
  type CaraKnowledgeChatMessage,
} from "@/lib/cara-knowledge-conversation";
import type { CaraKnowledgeCollected } from "./train-cara-knowledge-checklist";
import {
  persistBusinessKnowledge,
  type BusinessKnowledgePayload,
} from "@/lib/business-knowledge-save";
import {
  ONBOARDING_STEPS,
  requireOnboardingSession,
} from "@/lib/onboarding-session";
import { generateCaraCustomPrompt } from "@/lib/cara-custom-prompt";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

async function advanceToActionsStep(organizationId: string): Promise<never> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      onboarding_step: ONBOARDING_STEPS.actions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/actions");
}

import {
  CARA_BASELINE_HANDLE_OPTIONS,
  HANDLE_OPTION_BY_ID,
} from "./train-cara-constants";
import type { CaraHandleOptionId, TrainCaraStepId } from "./train-cara-constants";

export type TrainCaraPayload = BusinessKnowledgePayload & {
  preserveFaqs?: boolean;
  servicesNotOffered?: string;
  detailsToCollect?: string;
  handleOptions: CaraHandleOptionId[];
  routes: SavedRoute[];
  trainCaraStep?: TrainCaraStepId;
  captureDetailsNote?: string;
  transferPhone?: string;
  linkLabel?: string;
  linkUrl?: string;
  emailAddress?: string;
  whatsappContact?: string;
  meetingLink?: string;
  logNote?: string;
};

export type TrainCaraSaveResult = { ok: true } | { ok: false; message: string };

export type GenerateCaraNotesResult =
  | { ok: true; summary: string; extracted: CaraKnowledgeExtraction }
  | { ok: false; message: string };

export type CaraKnowledgeChatPayload = {
  messages: CaraKnowledgeChatMessage[];
  userMessage: string;
  summary: string;
  rawDescription: string;
  collected: CaraKnowledgeCollected;
};

export type CaraKnowledgeChatResult =
  | {
      ok: true;
      assistantMessage: string;
      summary: string;
      rawDescription: string;
      collected: CaraKnowledgeCollected;
      complete: boolean;
      refinedBusinessType?: string;
    }
  | { ok: false; message: string };

export async function continueCaraKnowledgeChat(
  payload: CaraKnowledgeChatPayload,
): Promise<CaraKnowledgeChatResult> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name, agent_business_type")
    .eq("id", session.organizationId)
    .maybeSingle();

  const result = await processCaraKnowledgeTurn({
    businessName: String(org?.name ?? "").trim() || "Your business",
    businessType: (org?.agent_business_type as string | null) ?? null,
    messages: payload.messages,
    userMessage: payload.userMessage,
    summary: payload.summary,
    rawDescription: payload.rawDescription,
    collected: payload.collected,
  });

  if (!result.ok) return result;
  return result;
}

async function persistTrainCara(
  organizationId: string,
  payload: TrainCaraPayload,
  options: { strictRoutes?: boolean; finalize?: boolean } = {},
): Promise<TrainCaraSaveResult> {
  const supabase = await createClient();

  const knowledgeSaved = await persistBusinessKnowledge(supabase, organizationId, {
    rawBusinessDescription: payload.rawBusinessDescription,
    businessKnowledgeSummary: payload.businessKnowledgeSummary,
    openingHours: payload.openingHours,
    serviceArea: payload.serviceArea,
    servicesOffered: payload.servicesOffered,
    emergencyCallouts: payload.emergencyCallouts,
    extraNotes: payload.extraNotes,
    refinedBusinessType: payload.refinedBusinessType,
    preserveFaqs: payload.preserveFaqs,
    faqs: payload.faqs,
    onboardingUiCopy: payload.onboardingUiCopy,
    captureFields: payload.captureFields,
    businessRules: payload.businessRules,
  });

  if (!knowledgeSaved.ok) return knowledgeSaved;

  const links = parseRoutingLinks(serializeRoutes(payload.routes)).map((link) =>
    normalizeRoutingLink(link),
  );

  if (options.strictRoutes) {
    const routeError = validateRoutes(routesFromStoredLinks(links));
    if (routeError) return { ok: false, message: routeError };
  }

  const admin = createAdminClient();
  const servicesNotOffered = String(payload.servicesNotOffered ?? "").trim();
  const detailsToCollect = String(payload.detailsToCollect ?? "").trim();
  const update: Record<string, unknown> = {
    cara_handle_options: payload.handleOptions,
    routing_links: links,
    train_cara_step: payload.trainCaraStep ?? null,
    agent_services_not_offered: servicesNotOffered || null,
    agent_details_to_collect: detailsToCollect || null,
    updated_at: new Date().toISOString(),
  };
  if (payload.emailAddress?.trim()) {
    update.notification_email = payload.emailAddress.trim();
  }
  const transfer = payload.transferPhone?.trim() ?? "";
  // The transfer number is where Cara puts callers through (voice worker reads
  // fallback_number); mirror it to notification_phone so the owner is reachable.
  update.fallback_number = transfer || null;
  if (transfer) {
    update.notification_phone = transfer;
  } else if (payload.whatsappContact?.trim()) {
    update.notification_phone = payload.whatsappContact.trim();
  }

  // On the final step, compile Cara's call-handling instructions from everything
  // captured so the voice worker has a ready prompt before the test call.
  if (options.finalize) {
    const { data: orgRow } = await admin
      .from("organizations")
      .select("name, agent_business_type")
      .eq("id", organizationId)
      .maybeSingle();

    const baseline = new Set<CaraHandleOptionId>(CARA_BASELINE_HANDLE_OPTIONS);
    const routingActions = payload.handleOptions
      .filter((id) => !baseline.has(id))
      .map((id) => HANDLE_OPTION_BY_ID.get(id)?.title)
      .filter((title): title is string => Boolean(title));

    update.custom_prompt = await generateCaraCustomPrompt({
      businessName: String(orgRow?.name ?? "").trim(),
      businessType: String(orgRow?.agent_business_type ?? "").trim(),
      knowledgeSummary: String(payload.businessKnowledgeSummary ?? "").trim(),
      openingHours: payload.openingHours,
      serviceArea: payload.serviceArea,
      servicesOffered: payload.servicesOffered,
      servicesNotOffered: payload.servicesNotOffered,
      detailsToCollect: payload.detailsToCollect,
      businessRules: payload.businessRules,
      faqs: payload.faqs?.map((f) => ({
        question: f.question,
        answer: f.answer,
      })),
      routingActions,
      transferNumber: transfer,
    });
  }

  const { error } = await admin.from("organizations").update(update).eq("id", organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/onboarding/knowledge");
  revalidatePath("/dashboard/routing");
  revalidatePath("/dashboard/agent-setup");
  return { ok: true };
}

export type GenerateOnboardingUiCopyResult =
  | { ok: true; copy: OnboardingUiCopy }
  | { ok: false; message: string };

export type EnsureOnboardingUiCopyPayload = {
  businessType?: string;
  niche?: string;
  rawBusinessDescription: string;
  openingHours?: string;
  serviceArea?: string;
  servicesOffered?: string;
};

export async function ensureOnboardingUiCopy(
  payload: EnsureOnboardingUiCopyPayload,
): Promise<GenerateOnboardingUiCopyResult> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name, agent_business_type, niche")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessType =
    payload.businessType?.trim() ||
    String(org?.agent_business_type ?? "").trim() ||
    undefined;

  const result = await generateOnboardingUiCopy({
    businessName: String(org?.name ?? "").trim() || "Your business",
    businessType,
    niche: payload.niche?.trim() || String(org?.niche ?? "").trim() || undefined,
    rawBusinessDescription: payload.rawBusinessDescription,
    openingHours: payload.openingHours,
    serviceArea: payload.serviceArea,
    servicesOffered: payload.servicesOffered,
  });

  if (!result.ok) return result;

  const { error } = await admin
    .from("organizations")
    .update({
      onboarding_ui_copy: result.copy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/onboarding/knowledge");
  return result;
}

export async function generateCaraNotesFromDescription(
  description: string,
): Promise<GenerateCaraNotesResult> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name, agent_business_type")
    .eq("id", session.organizationId)
    .maybeSingle();

  const result = await generateCaraBusinessNotes({
    businessName: String(org?.name ?? "").trim(),
    businessType: (org?.agent_business_type as string | null) ?? null,
    description,
  });

  if (!result.ok) return result;
  return { ok: true, summary: result.summary, extracted: result.extracted };
}

export async function saveTrainCaraProgress(
  payload: TrainCaraPayload,
): Promise<TrainCaraSaveResult> {
  const session = await requireOnboardingSession();
  return persistTrainCara(session.organizationId, payload, { strictRoutes: false });
}

export async function skipTrainCaraStep(): Promise<never> {
  const session = await requireOnboardingSession();
  const admin = createAdminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      train_cara_step: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/onboarding", "layout");
  revalidatePath("/onboarding/knowledge");
  return advanceToActionsStep(session.organizationId);
}

export async function completeTrainCaraStep(
  _: unknown,
  payload: TrainCaraPayload,
): Promise<TrainCaraSaveResult | never> {
  const session = await requireOnboardingSession();
  // Routes + transfer are configured in the next two steps (Actions, Your
  // number), so the call-handling prompt is compiled there, not here.
  const saved = await persistTrainCara(session.organizationId, payload, {
    strictRoutes: false,
  });
  if (!saved.ok) return saved;

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      train_cara_step: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/onboarding", "layout");
  return advanceToActionsStep(session.organizationId);
}
