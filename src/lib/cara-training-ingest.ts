import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyActionCategory } from "@/app/(dashboard)/dashboard/action-inbox/categories";
import { redactCallText } from "@/lib/transcript-redaction";

import { actionInboxTrainingQuestion } from "./cara-training-draft";
import { createTrainingItem } from "./cara-training";
import { isRoutineHandoff, isStructuredHoursTopic, type KnowledgeGapPayload } from "./cara-training-types";

function defaultQuestionForGap(gap: KnowledgeGapPayload): string {
  const q = gap.cara_question?.trim();
  if (q) return q;
  const topic = gap.topic.trim();
  return `A caller asked about ${topic}. What should I tell them?`;
}

function orgHasStructuredBusinessHours(raw: unknown): boolean {
  if (raw == null) return false;
  if (typeof raw === "string") return raw.trim().length > 0;
  if (typeof raw === "object") return Object.keys(raw as object).length > 0;
  return false;
}

/**
 * Ingest knowledge gaps reported by the voice worker after call-complete.
 */
export async function ingestCallKnowledgeGaps(
  admin: SupabaseClient,
  organizationId: string,
  callLogId: string,
  gaps: KnowledgeGapPayload[],
): Promise<void> {
  if (gaps.length === 0) return;

  const { data: org } = await admin
    .from("organizations")
    .select("business_hours")
    .eq("id", organizationId)
    .maybeSingle();

  const hasStructuredHours = orgHasStructuredBusinessHours(org?.business_hours);

  for (const gap of gaps) {
    const topic = String(gap.topic ?? "").trim();
    if (!topic) continue;

    const callerContextRaw = String(gap.caller_context ?? "").trim();
    const combined = [topic, callerContextRaw].filter(Boolean).join(" ");
    if (hasStructuredHours && isStructuredHoursTopic(combined)) {
      continue;
    }

    const callerContext = callerContextRaw
      ? redactCallText(callerContextRaw).text
      : null;

    await createTrainingItem(admin, {
      organizationId,
      source: "call_gap",
      gapSummary: topic,
      caraQuestion: defaultQuestionForGap(gap),
      callerContext,
      callLogId,
      notify: true,
    });
  }
}

/**
 * Create a training item from a genuine unanswered Action Inbox question
 * (e.g. "asked if we offer X"). Routine booking/callback handoffs are skipped.
 */
export async function ingestActionInboxTraining(
  admin: SupabaseClient,
  organizationId: string,
  actionTicketId: string,
  summary: string,
): Promise<void> {
  const category = classifyActionCategory(summary);
  if (category !== "unclear" && category !== "follow_up") {
    return;
  }
  if (isRoutineHandoff(summary)) {
    return;
  }

  const { gapSummary, caraQuestion } = actionInboxTrainingQuestion(summary);

  await createTrainingItem(admin, {
    organizationId,
    source: "action_inbox",
    gapSummary,
    caraQuestion,
    callerContext: summary.trim().slice(0, 500) || null,
    actionTicketId,
    notify: true,
  });
}
