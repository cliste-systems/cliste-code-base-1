"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardAdmin } from "@/lib/dashboard-admin";
import type { EntryClassification } from "@/lib/cara-knowledge-classification";
import {
  loadKnowledgeEntryClassifications,
  upsertKnowledgeEntryClassification,
} from "@/lib/cara-knowledge-folder-assignments";
import {
  buildKnowledgeFolders,
  parseServiceDepartmentNames,
} from "@/lib/cara-knowledge-folders";
import {
  resolvePersistedClassification,
  suggestClassificationForEntry,
} from "@/lib/cara-knowledge-classification";
import { unlearnKnowledgeEntryById } from "@/lib/cara-knowledge-unlearn";
import {
  cancelScheduledTemporalUpdate,
  endTemporalUpdateNow,
} from "@/lib/cara-knowledge-temporal-store";
import { buildCaraKnowledgeIndex } from "@/lib/cara-knowledge-index";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import {
  CARA_KNOWLEDGE_REVALIDATE_PATHS,
  DASHBOARD_ROUTES,
} from "@/lib/dashboard-routes";
import { createClient } from "@/utils/supabase/server";

function revalidateCaraKnowledge() {
  for (const path of CARA_KNOWLEDGE_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  revalidatePath(DASHBOARD_ROUTES.caraTraining);
}

async function loadKnowledgeContext(organizationId: string) {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "agent_faqs, agent_services_departments, agent_services_not_offered, agent_business_rules, business_knowledge_summary, raw_business_description, agent_opening_hours, agent_service_area, agent_base_town, updated_at",
    )
    .eq("id", organizationId)
    .maybeSingle();

  const { data: storeDepartments } = await supabase
    .from("store_departments")
    .select("name, active")
    .eq("organization_id", organizationId);

  const { data: rows } = await supabase
    .from("cara_training_items")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "applied")
    .limit(200);

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
    appliedTrainingItems: (rows ?? []).map((row) => ({
      id: String(row.id),
      organization_id: organizationId,
      status: "applied" as const,
      source: row.source,
      call_log_id: row.call_log_id,
      action_ticket_id: row.action_ticket_id,
      gap_summary: String(row.gap_summary ?? ""),
      caller_context: row.caller_context,
      cara_question: String(row.cara_question ?? ""),
      owner_messages: [],
      proposed_patch: row.proposed_patch,
      applied_patch: row.applied_patch,
      target_section: row.target_section,
      applied_at: row.applied_at,
      applied_by: row.applied_by,
      dismissed_at: row.dismissed_at,
      occurrence_count: Number(row.occurrence_count ?? 1),
      last_seen_at: String(row.last_seen_at ?? row.created_at),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    })),
    orgUpdatedAt: org?.updated_at ? String(org.updated_at) : null,
  });

  const folders = buildKnowledgeFolders({
    storeDepartmentNames: (storeDepartments ?? [])
      .filter((row) => row.active)
      .map((row) => String(row.name)),
    serviceDepartmentNames: parseServiceDepartmentNames(
      org?.agent_services_departments,
    ),
  });

  const classifications = await loadKnowledgeEntryClassifications(
    supabase,
    organizationId,
  );

  const legacyAssignments = new Map(
    [...classifications.entries()].map(([entryId, value]) => [
      entryId,
      value.folderId,
    ]),
  );

  return { supabase, index, folders, classifications, legacyAssignments };
}

export async function unlearnKnowledgeEntry(
  entryId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  const result = await unlearnKnowledgeEntryById(
    supabase,
    session.organizationId,
    session.user.id,
    entryId.trim(),
  );
  if (result.ok) {
    revalidateCaraKnowledge();
  }
  return result;
}

export async function reclassifyKnowledgeEntry(
  entryId: string,
  classification: EntryClassification,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await requireDashboardAdmin();
  const { supabase, index, folders, classifications } =
    await loadKnowledgeContext(session.organizationId);

  const entry = index.entries.find((row) => row.id === entryId.trim());
  if (!entry) {
    return { ok: false, message: "Knowledge item not found." };
  }

  const previous = resolvePersistedClassification(
    entry,
    folders,
    classifications.get(entry.id),
  );

  const result = await upsertKnowledgeEntryClassification(supabase, {
    organizationId: session.organizationId,
    entryId: entry.id,
    classification,
    actorId: session.user.id,
    title: entry.title,
    category: entry.category,
    previousClassification: previous,
    source: "entry_reclassify",
  });

  if (result.ok) {
    revalidateCaraKnowledge();
  }
  return result;
}

export async function confirmSuggestedKnowledgeClassification(
  entryId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await requireDashboardAdmin();
  const { index, folders, classifications, legacyAssignments } =
    await loadKnowledgeContext(session.organizationId);

  const entry = index.entries.find((row) => row.id === entryId.trim());
  if (!entry) {
    return { ok: false, message: "Knowledge item not found." };
  }

  if (classifications.has(entry.id) || legacyAssignments.has(entry.id)) {
    return { ok: false, message: "This entry already has a saved assignment." };
  }

  const suggested = suggestClassificationForEntry(entry, folders);
  if (suggested.folderId === "unsorted") {
    return {
      ok: false,
      message: "No clear suggestion yet — choose a group manually.",
    };
  }

  return reclassifyKnowledgeEntry(entry.id, suggested);
}

/** @deprecated Use reclassifyKnowledgeEntry */
export async function moveKnowledgeEntry(
  entryId: string,
  folderId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return reclassifyKnowledgeEntry(entryId, {
    folderId: folderId.trim(),
    departmentIds:
      folderId.trim() !== "general" && folderId.trim() !== "unsorted"
        ? [folderId.trim()]
        : [],
    topicLabels: [],
  });
}

export async function endTemporalKnowledgeUpdate(
  updateId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  const { createAdminClient } = await import("@/utils/supabase/admin");
  const admin = createAdminClient();
  const result = await endTemporalUpdateNow(supabase, admin, {
    organizationId: session.organizationId,
    updateId: updateId.trim(),
    actorId: session.user.id,
  });
  if (result.ok) {
    revalidateCaraKnowledge();
  }
  return result;
}

export async function cancelTemporalKnowledgeUpdate(
  updateId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await requireDashboardAdmin();
  const supabase = await createClient();
  const result = await cancelScheduledTemporalUpdate(supabase, {
    organizationId: session.organizationId,
    updateId: updateId.trim(),
    actorId: session.user.id,
  });
  if (result.ok) {
    revalidateCaraKnowledge();
  }
  return result;
}
