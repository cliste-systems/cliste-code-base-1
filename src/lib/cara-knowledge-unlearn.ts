import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  cleanAgentFaqs,
  type AgentFaq,
} from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  cleanBusinessRules,
  parseAgentBusinessRules,
} from "@/lib/agent-business-rules";
import {
  formatAgentKnowledgeList,
  parseAgentKnowledgeList,
} from "@/lib/agent-knowledge-format";
import {
  buildCaraKnowledgeIndex,
  type CaraKnowledgeEntry,
} from "@/lib/cara-knowledge-index";
import { regenerateCaraCustomPrompt } from "@/lib/cara-prompt-from-org";
import { revertTrainingItem } from "@/lib/cara-training";
import {
  parseCaraTrainingPatch,
  type CaraTrainingItemRow,
} from "@/lib/cara-training-types";
import { recordCaraKnowledgeEvent } from "@/lib/cara-knowledge-events";
import { deleteKnowledgeFolderAssignment } from "@/lib/cara-knowledge-folder-assignments";

function rowToTrainingItem(row: Record<string, unknown>): CaraTrainingItemRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    status: row.status as CaraTrainingItemRow["status"],
    source: row.source as CaraTrainingItemRow["source"],
    call_log_id: row.call_log_id ? String(row.call_log_id) : null,
    action_ticket_id: row.action_ticket_id ? String(row.action_ticket_id) : null,
    gap_summary: String(row.gap_summary ?? ""),
    caller_context: row.caller_context ? String(row.caller_context) : null,
    cara_question: String(row.cara_question ?? ""),
    owner_messages: [],
    proposed_patch: parseCaraTrainingPatch(row.proposed_patch),
    applied_patch: parseCaraTrainingPatch(row.applied_patch),
    target_section: (row.target_section as CaraTrainingItemRow["target_section"]) ?? null,
    applied_at: row.applied_at ? String(row.applied_at) : null,
    applied_by: row.applied_by ? String(row.applied_by) : null,
    dismissed_at: row.dismissed_at ? String(row.dismissed_at) : null,
    occurrence_count: Number(row.occurrence_count ?? 1),
    last_seen_at: String(row.last_seen_at ?? row.created_at ?? new Date().toISOString()),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

async function loadKnowledgeContext(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const [{ data: org }, { data: rows }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules, business_knowledge_summary, raw_business_description, agent_opening_hours, agent_service_area, agent_base_town",
      )
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("cara_training_items")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);

  const items = (rows ?? []).map((row) =>
    rowToTrainingItem(row as Record<string, unknown>),
  );

  const index = buildCaraKnowledgeIndex({
    faqs: org?.agent_faqs,
    servicesOffered: org?.agent_services_departments,
    servicesNotOffered: org?.agent_services_not_offered,
    businessRules: parseAgentBusinessRules(org?.agent_business_rules),
    businessKnowledgeSummary: org?.business_knowledge_summary,
    rawBusinessDescription: org?.raw_business_description,
    openingHours: org?.agent_opening_hours,
    serviceArea: org?.agent_service_area,
    agentBaseTown: org?.agent_base_town,
    appliedTrainingItems: items.filter((item) => item.status === "applied"),
    openTrainingItems: items.filter(
      (item) => item.status === "awaiting_answer" || item.status === "draft_ready",
    ),
  });

  return { org, index };
}

function removeFaq(faqs: AgentFaq[], title: string): AgentFaq[] {
  const key = title.trim().toLowerCase();
  return faqs.filter((faq) => faq.question.trim().toLowerCase() !== key);
}

function removeListItem(text: string, label: string): string {
  const key = label.trim().toLowerCase();
  return formatAgentKnowledgeList(
    parseAgentKnowledgeList(text).filter((item) => item.trim().toLowerCase() !== key),
  );
}

export async function unlearnKnowledgeEntryById(
  supabase: SupabaseClient,
  organizationId: string,
  actorId: string,
  entryId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { org, index } = await loadKnowledgeContext(supabase, organizationId);
  const entry = index.entries.find((row) => row.id === entryId);
  if (!entry) {
    return { ok: false, message: "Knowledge item not found." };
  }

  if (entry.trainingItemId) {
    const reverted = await revertTrainingItem(
      supabase,
      organizationId,
      entry.trainingItemId,
      actorId,
    );
    if (!reverted.ok) return reverted;
    return { ok: true };
  }

  if (!org) {
    return { ok: false, message: "Organization not found." };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };

  if (entry.source === "faq") {
    update.agent_faqs = removeFaq(
      cleanAgentFaqs(org.agent_faqs),
      entry.title,
    );
  } else if (entry.category === "services") {
    update.agent_services_departments = removeListItem(
      String(org.agent_services_departments ?? ""),
      entry.title,
    );
  } else if (entry.category === "not-offered") {
    update.agent_services_not_offered = removeListItem(
      String(org.agent_services_not_offered ?? ""),
      entry.title,
    );
  } else if (entry.source === "rule") {
    update.agent_business_rules = cleanBusinessRules(
      parseAgentBusinessRules(org.agent_business_rules).filter(
        (rule) => rule.trim().toLowerCase() !== entry.title.trim().toLowerCase(),
      ),
    );
  } else {
    return {
      ok: false,
      message:
        "This store fact is compiled from Business setup. Edit it there instead of unlearning here.",
    };
  }

  const { error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", organizationId);
  if (error) {
    return { ok: false, message: error.message };
  }

  const regen = await regenerateCaraCustomPrompt(supabase, organizationId);
  if (!regen.ok) {
    return { ok: false, message: regen.message };
  }

  await recordCaraKnowledgeEvent(supabase, {
    organizationId,
    actorId,
    eventType: "unlearned",
    category: entry.category,
    title: entry.title,
    payload: { entry_id: entry.id, source: entry.source },
    source: "unlearn",
  });

  await deleteKnowledgeFolderAssignment(supabase, organizationId, entry.id);

  return { ok: true };
}

export function findKnowledgeEntry(
  index: { entries: CaraKnowledgeEntry[] },
  entryId: string,
): CaraKnowledgeEntry | null {
  return index.entries.find((entry) => entry.id === entryId) ?? null;
}
