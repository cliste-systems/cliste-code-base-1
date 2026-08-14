import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyActionCategory } from "@/app/(dashboard)/dashboard/action-inbox/categories";
import { redactCallText } from "@/lib/transcript-redaction";

import { actionInboxTrainingQuestion } from "./cara-training-draft";
import { createTrainingItem } from "./cara-training";
import { classifyGapKind } from "./gap-kind";
import { isRoutineHandoff, type KnowledgeGapPayload } from "./cara-training-types";

function defaultQuestionForGap(gap: KnowledgeGapPayload): string {
  const q = gap.cara_question?.trim();
  if (q) return q;
  const topic = gap.topic.trim();
  return `A caller asked about ${topic}. What should I tell them?`;
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
  for (const gap of gaps) {
    const topic = String(gap.topic ?? "").trim();
    if (!topic) continue;

    const callerContextRaw = String(gap.caller_context ?? "").trim();
    const callerContext = callerContextRaw
      ? redactCallText(callerContextRaw).text
      : null;

    const caraQuestion = defaultQuestionForGap(gap);
    await createTrainingItem(admin, {
      organizationId,
      source: "call_gap",
      gapSummary: topic,
      caraQuestion,
      callerContext,
      callLogId,
      notify: true,
      gapKind: classifyGapKind(topic, caraQuestion, callerContext),
    });
  }
}

/**
 * Opt-in: create a training item from an Action Inbox ticket.
 * Not called by the voice action-ticket route (Phase 3) — Action Inbox
 * follow-ups stay on Calls; Knowledge Gaps come from post-call `knowledge_gaps`.
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

  const callerContext = summary.trim().slice(0, 500) || null;
  await createTrainingItem(admin, {
    organizationId,
    source: "action_inbox",
    gapSummary,
    caraQuestion,
    callerContext,
    actionTicketId,
    notify: true,
    gapKind: classifyGapKind(gapSummary, caraQuestion, callerContext),
  });
}
