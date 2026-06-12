"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import { draftOwnerInitiatedQuestion } from "@/lib/cara-training-draft";
import {
  confirmTrainingItem,
  createTrainingItem,
  dismissTrainingItem,
  resetTrainingItemToAnswer,
  revertTrainingItem,
  submitOwnerAnswer,
} from "@/lib/cara-training";
import { createClient } from "@/utils/supabase/server";

type ActionResult = { ok: true } | { ok: false; message: string };

export async function answerTrainingItem(
  itemId: string,
  answerText: string,
): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return submitOwnerAnswer(
    supabase,
    session.organizationId,
    itemId,
    answerText,
  );
}

export async function confirmTrainingDraft(itemId: string): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return confirmTrainingItem(
    supabase,
    session.organizationId,
    itemId,
    session.user.id,
  );
}

export async function dismissTrainingDraft(itemId: string): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return dismissTrainingItem(supabase, session.organizationId, itemId);
}

export async function editTrainingAnswer(itemId: string): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return resetTrainingItemToAnswer(supabase, session.organizationId, itemId);
}

export async function revertAppliedTraining(itemId: string): Promise<ActionResult> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  return revertTrainingItem(supabase, session.organizationId, itemId);
}

export async function startOwnerInitiatedTraining(
  description: string,
): Promise<
  { ok: true; itemId: string } | { ok: false; message: string }
> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", session.organizationId)
    .maybeSingle();

  const businessName = String(org?.name ?? "").trim() || "your business";
  const drafted = await draftOwnerInitiatedQuestion({
    businessName,
    ownerDescription: description,
  });

  if (!drafted.ok) {
    return drafted;
  }

  const { createAdminClient } = await import("@/utils/supabase/admin");
  const admin = createAdminClient();
  const created = await createTrainingItem(admin, {
    organizationId: session.organizationId,
    source: "owner_initiated",
    gapSummary: drafted.gapSummary,
    caraQuestion: drafted.question,
    notify: false,
  });

  if (!created.ok) {
    return created;
  }

  revalidatePath("/dashboard/cara-training");
  return { ok: true, itemId: created.itemId };
}
