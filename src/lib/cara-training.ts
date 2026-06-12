import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import {
  cleanAgentFaqs,
  MAX_FAQS,
  type AgentFaq,
} from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  cleanBusinessRules,
  normalizeBusinessRuleKey,
  parseAgentBusinessRules,
} from "@/lib/agent-business-rules";
import {
  formatAgentKnowledgeList,
  parseAgentKnowledgeList,
} from "@/lib/agent-knowledge-format";
import { deriveCaraCapabilities } from "@/lib/cara-capabilities";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import {
  dedupeCaraSetupChips,
  normalizeCaraSetupChip,
} from "@/lib/cara-setup-chips";
import { validateCallHandlingAdd } from "@/lib/call-handling-boundary";

import {
  draftTrainingPatchFromOwnerAnswer,
  type CaraTrainingKnowledgeSnapshot,
} from "./cara-training-draft";
import { notifyCaraTrainingOwner } from "./cara-training-notify";
import {
  normalizeTrainingTopic,
  parseCaraTrainingPatch,
  parseOwnerMessages,
  targetSectionForPatch,
  type CaraTrainingItemRow,
  type CaraTrainingOwnerMessage,
  type CaraTrainingPatch,
  type CaraTrainingSource,
  type CaraTrainingStatus,
} from "./cara-training-types";

export const CARA_TRAINING_OPEN_STATUSES: CaraTrainingStatus[] = [
  "awaiting_answer",
  "draft_ready",
];

const TRAINING_REVALIDATE_PATHS = [
  "/dashboard",
  "/dashboard/cara-training",
  "/dashboard/cara-setup",
  "/dashboard/cara-setup/general",
  "/dashboard/cara-setup/services",
  "/dashboard/cara-setup/call-handling",
  "/dashboard/cara-setup/answers",
] as const;

function revalidateCaraTraining() {
  for (const path of TRAINING_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

function rowToItem(row: Record<string, unknown>): CaraTrainingItemRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    status: row.status as CaraTrainingItemRow["status"],
    source: row.source as CaraTrainingItemRow["source"],
    call_log_id: row.call_log_id ? String(row.call_log_id) : null,
    action_ticket_id: row.action_ticket_id
      ? String(row.action_ticket_id)
      : null,
    gap_summary: String(row.gap_summary ?? ""),
    caller_context: row.caller_context ? String(row.caller_context) : null,
    cara_question: String(row.cara_question ?? ""),
    owner_messages: parseOwnerMessages(row.owner_messages),
    proposed_patch: parseCaraTrainingPatch(row.proposed_patch),
    applied_patch: parseCaraTrainingPatch(row.applied_patch),
    target_section: (row.target_section as CaraTrainingItemRow["target_section"]) ?? null,
    applied_at: row.applied_at ? String(row.applied_at) : null,
    applied_by: row.applied_by ? String(row.applied_by) : null,
    dismissed_at: row.dismissed_at ? String(row.dismissed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function loadKnowledgeSnapshot(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CaraTrainingKnowledgeSnapshot> {
  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules, routing_links, fallback_number",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const name = String(org?.name ?? "").trim() || "the business";
  const faqs = cleanAgentFaqs(org?.agent_faqs);
  return {
    businessName: name,
    faqs,
    servicesOffered: parseAgentKnowledgeList(
      String(org?.agent_services_departments ?? ""),
    ),
    servicesNotOffered: parseAgentKnowledgeList(
      String(org?.agent_services_not_offered ?? ""),
    ),
    businessRules: parseAgentBusinessRules(org?.agent_business_rules),
  };
}

function validatePatchForApply(
  patch: CaraTrainingPatch,
  knowledge: CaraTrainingKnowledgeSnapshot,
): { ok: true } | { ok: false; message: string } {
  const caps = deriveCaraCapabilities([], undefined);

  switch (patch.kind) {
    case "faq": {
      const question = patch.question.trim();
      const answer = patch.answer.trim();
      if (!question || !answer) {
        return { ok: false, message: "FAQ needs both a question and an answer." };
      }
      if (knowledge.faqs.length >= MAX_FAQS) {
        return {
          ok: false,
          message: `You already have ${MAX_FAQS} FAQs. Remove one in Cara Setup before adding another.`,
        };
      }
      return { ok: true };
    }
    case "service_offered":
    case "service_not_offered": {
      const label = normalizeCaraSetupChip(patch.label);
      if (!label) {
        return { ok: false, message: "Service label cannot be empty." };
      }
      return { ok: true };
    }
    case "business_rule": {
      const validation = validateCallHandlingAdd(patch.rule, "rule", caps);
      if (!validation.ok) {
        return { ok: false, message: validation.block };
      }
      return { ok: true };
    }
  }
}

type OrgKnowledgeFields = {
  agent_faqs: AgentFaq[];
  agent_services_departments: string;
  agent_services_not_offered: string;
  agent_business_rules: string[];
};

function patchDedupeKey(patch: CaraTrainingPatch): string {
  switch (patch.kind) {
    case "faq":
      return `faq:${patch.question.trim().toLowerCase()}`;
    case "service_offered":
      return `service:${normalizeCaraSetupChip(patch.label).toLowerCase()}`;
    case "service_not_offered":
      return `excluded:${normalizeCaraSetupChip(patch.label).toLowerCase()}`;
    case "business_rule":
      return `rule:${normalizeBusinessRuleKey(patch.rule)}`;
  }
}

function removePatchFromOrgFields(
  current: OrgKnowledgeFields,
  patch: CaraTrainingPatch,
): OrgKnowledgeFields {
  switch (patch.kind) {
    case "faq": {
      const key = patch.question.trim().toLowerCase();
      return {
        ...current,
        agent_faqs: current.agent_faqs.filter(
          (faq) => faq.question.trim().toLowerCase() !== key,
        ),
      };
    }
    case "service_offered": {
      const key = normalizeCaraSetupChip(patch.label).toLowerCase();
      const chips = parseAgentKnowledgeList(current.agent_services_departments).filter(
        (chip) => normalizeCaraSetupChip(chip).toLowerCase() !== key,
      );
      return {
        ...current,
        agent_services_departments: formatAgentKnowledgeList(chips),
      };
    }
    case "service_not_offered": {
      const key = normalizeCaraSetupChip(patch.label).toLowerCase();
      const chips = parseAgentKnowledgeList(
        current.agent_services_not_offered,
      ).filter((chip) => normalizeCaraSetupChip(chip).toLowerCase() !== key);
      return {
        ...current,
        agent_services_not_offered: formatAgentKnowledgeList(chips),
      };
    }
    case "business_rule": {
      const key = normalizeBusinessRuleKey(patch.rule);
      return {
        ...current,
        agent_business_rules: current.agent_business_rules.filter(
          (rule) => normalizeBusinessRuleKey(rule) !== key,
        ),
      };
    }
  }
}

function orgKnowledgeFieldsEqual(
  left: OrgKnowledgeFields,
  right: OrgKnowledgeFields,
): boolean {
  return (
    left.agent_services_departments === right.agent_services_departments &&
    left.agent_services_not_offered === right.agent_services_not_offered &&
    left.agent_business_rules.length === right.agent_business_rules.length &&
    left.agent_business_rules.every(
      (rule, index) => rule === right.agent_business_rules[index],
    ) &&
    left.agent_faqs.length === right.agent_faqs.length &&
    left.agent_faqs.every(
      (faq, index) =>
        faq.question === right.agent_faqs[index]?.question &&
        faq.answer === right.agent_faqs[index]?.answer,
    )
  );
}

function mergePatchIntoOrgFields(
  current: OrgKnowledgeFields,
  patch: CaraTrainingPatch,
): OrgKnowledgeFields {
  switch (patch.kind) {
    case "faq": {
      const nextFaqs = cleanAgentFaqs([
        ...current.agent_faqs,
        { question: patch.question.trim(), answer: patch.answer.trim() },
      ]);
      return { ...current, agent_faqs: nextFaqs };
    }
    case "service_offered": {
      const chips = dedupeCaraSetupChips([
        ...parseAgentKnowledgeList(current.agent_services_departments),
        normalizeCaraSetupChip(patch.label),
      ]);
      return {
        ...current,
        agent_services_departments: formatAgentKnowledgeList(chips),
      };
    }
    case "service_not_offered": {
      const chips = dedupeCaraSetupChips([
        ...parseAgentKnowledgeList(current.agent_services_not_offered),
        normalizeCaraSetupChip(patch.label),
      ]);
      return {
        ...current,
        agent_services_not_offered: formatAgentKnowledgeList(chips),
      };
    }
    case "business_rule": {
      const rules = cleanBusinessRules([
        ...current.agent_business_rules,
        patch.rule.trim(),
      ]);
      return { ...current, agent_business_rules: rules };
    }
  }
}

export type CreateTrainingItemInput = {
  organizationId: string;
  source: CaraTrainingSource;
  gapSummary: string;
  caraQuestion: string;
  callerContext?: string | null;
  callLogId?: string | null;
  actionTicketId?: string | null;
  notify?: boolean;
};

export async function createTrainingItem(
  admin: SupabaseClient,
  input: CreateTrainingItemInput,
): Promise<
  { ok: true; itemId: string } | { ok: false; message: string; skipped?: boolean }
> {
  const gapSummary = input.gapSummary.trim();
  const caraQuestion = input.caraQuestion.trim();
  if (!gapSummary || !caraQuestion) {
    return { ok: false, message: "gap_summary and cara_question are required." };
  }

  if (input.actionTicketId) {
    const { data: existing } = await admin
      .from("cara_training_items")
      .select("id")
      .eq("action_ticket_id", input.actionTicketId)
      .maybeSingle();
    if (existing?.id) {
      return { ok: true, itemId: String(existing.id) };
    }
  }

  const normalizedTopic = normalizeTrainingTopic(gapSummary);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOpen } = await admin
    .from("cara_training_items")
    .select("id, gap_summary")
    .eq("organization_id", input.organizationId)
    .in("status", CARA_TRAINING_OPEN_STATUSES)
    .gte("created_at", weekAgo);

  for (const row of recentOpen ?? []) {
    if (normalizeTrainingTopic(String(row.gap_summary ?? "")) === normalizedTopic) {
      return {
        ok: false,
        message: "A similar training item is already open.",
        skipped: true,
      };
    }
  }

  const { data: inserted, error } = await admin
    .from("cara_training_items")
    .insert({
      organization_id: input.organizationId,
      status: "awaiting_answer",
      source: input.source,
      gap_summary: gapSummary,
      caller_context: input.callerContext?.trim() || null,
      cara_question: caraQuestion,
      call_log_id: input.callLogId ?? null,
      action_ticket_id: input.actionTicketId ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    console.error("[cara-training] insert", error);
    return { ok: false, message: "Failed to create training item." };
  }

  const itemId = String(inserted.id);

  if (input.notify !== false) {
    try {
      await notifyCaraTrainingOwner(admin, input.organizationId, {
        itemId,
        gapSummary,
      });
    } catch (e) {
      console.error("[cara-training] notify failed", e);
    }
  }

  revalidateCaraTraining();
  return { ok: true, itemId };
}

export async function submitOwnerAnswer(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  answerText: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("cara_training_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Training item not found." };
  }

  const item = rowToItem(row as Record<string, unknown>);
  if (item.status !== "awaiting_answer") {
    return { ok: false, message: "This item is not waiting for an answer." };
  }

  const answer = answerText.trim();
  if (!answer) {
    return { ok: false, message: "Enter an answer." };
  }

  const knowledge = await loadKnowledgeSnapshot(supabase, organizationId);
  const draft = await draftTrainingPatchFromOwnerAnswer({
    gapSummary: item.gap_summary,
    callerContext: item.caller_context,
    caraQuestion: item.cara_question,
    ownerAnswer: answer,
    knowledge,
  });

  if (!draft.ok) {
    return { ok: false, message: draft.message };
  }

  const validation = validatePatchForApply(draft.patch, knowledge);
  if (!validation.ok) {
    return validation;
  }

  const messages: CaraTrainingOwnerMessage[] = [
    ...item.owner_messages,
    { role: "user", content: answer, at: new Date().toISOString() },
  ];

  const targetSection = targetSectionForPatch(draft.patch);
  const { error: updateError } = await supabase
    .from("cara_training_items")
    .update({
      status: "draft_ready",
      owner_messages: messages,
      proposed_patch: draft.patch,
      target_section: targetSection,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function confirmTrainingItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  appliedByUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("cara_training_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Training item not found." };
  }

  const item = rowToItem(row as Record<string, unknown>);
  if (item.status !== "draft_ready" || !item.proposed_patch) {
    return { ok: false, message: "No draft is ready to confirm." };
  }

  const knowledge = await loadKnowledgeSnapshot(supabase, organizationId);
  const validation = validatePatchForApply(item.proposed_patch, knowledge);
  if (!validation.ok) {
    return validation;
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const current: OrgKnowledgeFields = {
    agent_faqs: cleanAgentFaqs(org?.agent_faqs),
    agent_services_departments: String(org?.agent_services_departments ?? ""),
    agent_services_not_offered: String(org?.agent_services_not_offered ?? ""),
    agent_business_rules: parseAgentBusinessRules(org?.agent_business_rules),
  };

  const merged = mergePatchIntoOrgFields(current, item.proposed_patch);
  const now = new Date().toISOString();

  const { error: orgError } = await supabase
    .from("organizations")
    .update({
      agent_faqs: merged.agent_faqs,
      agent_services_departments: merged.agent_services_departments,
      agent_services_not_offered: merged.agent_services_not_offered,
      agent_business_rules: merged.agent_business_rules,
      updated_at: now,
    })
    .eq("id", organizationId);

  if (orgError) {
    return { ok: false, message: orgError.message };
  }

  const regen = await regenerateCaraCustomPrompt(supabase, organizationId);
  if (!regen.ok) {
    return { ok: false, message: regen.message };
  }

  const { error: itemError } = await supabase
    .from("cara_training_items")
    .update({
      status: "applied",
      applied_patch: item.proposed_patch,
      applied_at: now,
      applied_by: appliedByUserId,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (itemError) {
    return { ok: false, message: itemError.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function dismissTrainingItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("cara_training_items")
    .update({
      status: "dismissed",
      dismissed_at: now,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .in("status", ["awaiting_answer", "draft_ready"]);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function resetTrainingItemToAnswer(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("cara_training_items")
    .update({
      status: "awaiting_answer",
      proposed_patch: null,
      target_section: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .eq("status", "draft_ready");

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}

export async function revertTrainingItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("cara_training_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Training item not found." };
  }

  const item = rowToItem(row as Record<string, unknown>);
  if (item.status !== "applied" || !item.applied_patch) {
    return { ok: false, message: "Only applied items can be reverted." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const patch = item.applied_patch;
  const current: OrgKnowledgeFields = {
    agent_faqs: cleanAgentFaqs(org?.agent_faqs),
    agent_services_departments: String(org?.agent_services_departments ?? ""),
    agent_services_not_offered: String(org?.agent_services_not_offered ?? ""),
    agent_business_rules: parseAgentBusinessRules(org?.agent_business_rules),
  };

  const { data: siblingRows } = await supabase
    .from("cara_training_items")
    .select("applied_patch")
    .eq("organization_id", organizationId)
    .eq("status", "applied")
    .neq("id", itemId);

  const patchKey = patchDedupeKey(patch);
  const hasSiblingWithSamePatch = (siblingRows ?? []).some((row) => {
    const siblingPatch = parseCaraTrainingPatch(
      (row as { applied_patch?: unknown }).applied_patch,
    );
    return siblingPatch !== null && patchDedupeKey(siblingPatch) === patchKey;
  });

  const reverted = hasSiblingWithSamePatch
    ? current
    : removePatchFromOrgFields(current, patch);
  const orgChanged = !orgKnowledgeFieldsEqual(current, reverted);
  const now = new Date().toISOString();

  if (orgChanged) {
    const { error: orgError } = await supabase
      .from("organizations")
      .update({
        agent_faqs: reverted.agent_faqs,
        agent_services_departments: reverted.agent_services_departments,
        agent_services_not_offered: reverted.agent_services_not_offered,
        agent_business_rules: reverted.agent_business_rules,
        updated_at: now,
      })
      .eq("id", organizationId);

    if (orgError) {
      return { ok: false, message: orgError.message };
    }

    const regen = await regenerateCaraCustomPrompt(supabase, organizationId);
    if (!regen.ok) {
      return { ok: false, message: regen.message };
    }
  }

  const { error: itemError } = await supabase
    .from("cara_training_items")
    .update({
      status: "dismissed",
      dismissed_at: now,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (itemError) {
    return { ok: false, message: itemError.message };
  }

  revalidateCaraTraining();
  return { ok: true };
}
