"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { ENGINEER_TEST_TRAINING_BLOCK_MESSAGE } from "@/lib/engineer-test-call";
import { trainingItemFromEngineerTest } from "@/lib/engineer-test-artifact-guard";
import { ownerInitiatedTeachMetadata } from "@/lib/cara-training-owner-initiated";
import {
  checkTrainingDraftSafety,
  clearDeferredTrainingItem,
  confirmTrainingItem,
  createTrainingItem,
  deferTrainingItem,
  dismissTrainingItem,
  prepareTemporalTrainingForConfirm,
  previewOwnerInitiatedTeach as previewOwnerInitiatedTeachDraft,
  resolveCallGapNo,
  resolveCallGapYes,
  resetTrainingItemToAnswer,
  revertTrainingItem,
  submitExistenceQuickAnswer,
  submitOwnerAnswer,
  type TrainingSafetyIssue,
} from "@/lib/cara-training";
import type { TrainingDismissReason } from "@/lib/cara-training-admission";
import {
  CARA_KNOWLEDGE_REVALIDATE_PATHS,
  DASHBOARD_ROUTES,
} from "@/lib/dashboard-routes";
import { createClient } from "@/utils/supabase/server";
import type { EntryClassification } from "@/lib/cara-knowledge-classification";
import { setTrainingKnowledgeClassification } from "@/lib/cara-knowledge-folder-assignments";
import type { TemporalDraftInput } from "@/lib/cara-knowledge-temporal";
import type { CaraTrainingPatch } from "@/lib/cara-training-types";
import { saveTrainingTemporalDraft } from "@/lib/cara-knowledge-temporal-store";

type ActionResult = { ok: true } | { ok: false; message: string };

async function blockEngineerTestTraining(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  itemId: string,
): Promise<ActionResult | null> {
  if (await trainingItemFromEngineerTest(supabase, organizationId, itemId)) {
    return { ok: false, message: ENGINEER_TEST_TRAINING_BLOCK_MESSAGE };
  }
  return null;
}

export async function answerTrainingItem(
  itemId: string,
  answerText: string,
): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  const blocked = await blockEngineerTestTraining(
    supabase,
    session.organizationId,
    itemId,
  );
  if (blocked) return blocked;
  return submitOwnerAnswer(
    supabase,
    session.organizationId,
    itemId,
    answerText,
  );
}

export async function confirmTrainingDraft(
  itemId: string,
  classification?: EntryClassification,
): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  const blocked = await blockEngineerTestTraining(
    supabase,
    session.organizationId,
    itemId,
  );
  if (blocked) return blocked;
  if (classification) {
    const { setTrainingKnowledgeClassification } = await import(
      "@/lib/cara-knowledge-folder-assignments"
    );
    const classificationResult = await setTrainingKnowledgeClassification(
      supabase,
      session.organizationId,
      itemId,
      classification,
    );
    if (!classificationResult.ok) return classificationResult;
  }
  return confirmTrainingItem(
    supabase,
    session.organizationId,
    itemId,
    session.user.id,
  );
}

export async function dismissTrainingDraft(
  itemId: string,
  reason?: TrainingDismissReason,
): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  const blocked = await blockEngineerTestTraining(
    supabase,
    session.organizationId,
    itemId,
  );
  if (blocked) return blocked;
  return dismissTrainingItem(supabase, session.organizationId, itemId, reason);
}

export async function resolveCallGapYesAction(
  itemId: string,
  details?: string | null,
): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return resolveCallGapYes(
    supabase,
    session.organizationId,
    itemId,
    session.user.id,
    details,
  );
}

export async function resolveCallGapNoAction(
  itemId: string,
  details?: string | null,
): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return resolveCallGapNo(
    supabase,
    session.organizationId,
    itemId,
    session.user.id,
    details,
  );
}

export async function submitExistenceAnswerAction(
  itemId: string,
  choice: "yes" | "no" | "depends",
  details?: string | null,
): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return submitExistenceQuickAnswer(
    supabase,
    session.organizationId,
    itemId,
    session.user.id,
    { choice, details },
  );
}

export async function deferTrainingItemAction(itemId: string): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return deferTrainingItem(supabase, session.organizationId, itemId);
}

export async function clearDeferredTrainingItemAction(
  itemId: string,
): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return clearDeferredTrainingItem(supabase, session.organizationId, itemId);
}

export async function editTrainingAnswer(itemId: string): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return resetTrainingItemToAnswer(supabase, session.organizationId, itemId);
}

export async function revertAppliedTraining(itemId: string): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return revertTrainingItem(supabase, session.organizationId, itemId, session.user.id);
}

export type { TrainingSafetyIssue };

export async function checkTrainingDraftSafetyAction(
  itemId: string,
): Promise<{ ok: true } | { ok: false; issues: TrainingSafetyIssue[] }> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return checkTrainingDraftSafety(
    supabase,
    session.organizationId,
    itemId,
  );
}

export async function previewOwnerInitiatedTeach(
  description: string,
  teachingContext?: {
    durationMode?: "standard" | "limited" | "ongoing";
    durationSummary?: string | null;
  } | null,
): Promise<
  | { ok: true; patch: CaraTrainingPatch }
  | { ok: false; safetyBlocked: true; issues: TrainingSafetyIssue[]; patch: CaraTrainingPatch }
  | { ok: false; needsClarification: string }
  | { ok: false; message: string }
> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return previewOwnerInitiatedTeachDraft(
    supabase,
    session.organizationId,
    description,
    teachingContext,
  );
}

export async function startOwnerInitiatedTraining(
  description: string,
  classification?: EntryClassification | null,
  temporalDraft?: TemporalDraftInput | null,
): Promise<
  { ok: true; itemId: string } | { ok: false; message: string }
> {
  const session = await requireDashboardAdmin();

  const ownerDescription = description.trim();
  if (!ownerDescription) {
    return { ok: false, message: "Describe what Cara should know." };
  }

  const { gapSummary, caraQuestion } = ownerInitiatedTeachMetadata({
    ownerDescription,
    temporalTitle: temporalDraft?.title,
  });

  const { createAdminClient } = await import("@/utils/supabase/admin");
  const admin = createAdminClient();
  const writeClient = admin;
  const created = await createTrainingItem(admin, {
    organizationId: session.organizationId,
    source: "owner_initiated",
    gapSummary,
    caraQuestion,
    notify: false,
    knowledgeFolderId: classification?.folderId ?? null,
    knowledgeDepartmentIds: classification?.departmentIds ?? [],
    knowledgeTopicLabels: classification?.topicLabels ?? [],
  });

  if (!created.ok) {
    return created;
  }

  if (temporalDraft) {
    const savedDraft = await saveTrainingTemporalDraft(writeClient, {
      organizationId: session.organizationId,
      itemId: created.itemId,
      draft: temporalDraft,
    });
    if (!savedDraft.ok) {
      return savedDraft;
    }
  }

  if (classification) {
    const classificationResult = await setTrainingKnowledgeClassification(
      writeClient,
      session.organizationId,
      created.itemId,
      classification,
    );
    if (!classificationResult.ok) {
      return classificationResult;
    }
  }

  const answered = temporalDraft
    ? await prepareTemporalTrainingForConfirm(
        writeClient,
        session.organizationId,
        created.itemId,
        ownerDescription,
      )
    : await submitOwnerAnswer(
        writeClient,
        session.organizationId,
        created.itemId,
        ownerDescription,
      );
  if (!answered.ok) {
    return answered;
  }

  const confirmed = await confirmTrainingItem(
    writeClient,
    session.organizationId,
    created.itemId,
    session.user.id,
  );
  if (!confirmed.ok) {
    return confirmed;
  }

  revalidatePath(DASHBOARD_ROUTES.caraKnowledgeNeedsInput);
  for (const path of CARA_KNOWLEDGE_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  return { ok: true, itemId: created.itemId };
}
