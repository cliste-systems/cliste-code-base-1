import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EntryClassification } from "@/lib/cara-knowledge-classification";
import { suggestKnowledgeAssignment } from "@/lib/cara-knowledge-classification";
import type { CaraTrainingPatch } from "@/lib/cara-training-types";
import {
  buildKnowledgeFolders,
  entryIdForTrainingPatch,
  GENERAL_KNOWLEDGE_FOLDER_ID,
  parseServiceDepartmentNames,
  type KnowledgeFolderAssignment,
} from "@/lib/cara-knowledge-folders";
import { recordCaraKnowledgeEvent } from "@/lib/cara-knowledge-events";

type AssignmentRow = {
  entry_id: string;
  folder_id: string;
  department_ids: string[] | null;
  topic_labels: string[] | null;
  updated_at: string;
};

function rowToClassification(row: AssignmentRow): EntryClassification {
  return {
    folderId: row.folder_id,
    departmentIds: row.department_ids ?? [],
    topicLabels: row.topic_labels ?? [],
  };
}

export async function loadKnowledgeEntryClassifications(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Map<string, EntryClassification>> {
  const { data, error } = await supabase
    .from("cara_knowledge_folder_assignments")
    .select("entry_id, folder_id, department_ids, topic_labels, updated_at")
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[cara-knowledge] load entry classifications", error.message);
    return new Map();
  }

  const map = new Map<string, EntryClassification>();
  for (const row of (data ?? []) as AssignmentRow[]) {
    map.set(row.entry_id, rowToClassification(row));
  }
  return map;
}

/** Legacy folder-id map for callers that only need primary folder. */
export async function loadKnowledgeFolderAssignments(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Map<string, string>> {
  const classifications = await loadKnowledgeEntryClassifications(
    supabase,
    organizationId,
  );
  return new Map(
    [...classifications.entries()].map(([entryId, value]) => [
      entryId,
      value.folderId,
    ]),
  );
}

export async function loadKnowledgeFolderAssignmentRows(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<KnowledgeFolderAssignment[]> {
  const { data, error } = await supabase
    .from("cara_knowledge_folder_assignments")
    .select("entry_id, folder_id, updated_at")
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[cara-knowledge] load folder assignment rows", error.message);
    return [];
  }

  return ((data ?? []) as AssignmentRow[]).map((row) => ({
    entryId: row.entry_id,
    folderId: row.folder_id,
    updatedAt: row.updated_at,
  }));
}

export async function upsertKnowledgeEntryClassification(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    entryId: string;
    classification: EntryClassification;
    actorId?: string | null;
    title?: string;
    category?: string | null;
    previousClassification?: EntryClassification | null;
    source?: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("cara_knowledge_folder_assignments").upsert(
    {
      organization_id: input.organizationId,
      entry_id: input.entryId,
      folder_id: input.classification.folderId,
      department_ids: input.classification.departmentIds,
      topic_labels: input.classification.topicLabels,
      updated_at: now,
    },
    { onConflict: "organization_id,entry_id" },
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  const previous = input.previousClassification;
  const changed =
    !previous ||
    previous.folderId !== input.classification.folderId ||
    previous.departmentIds.join(",") !== input.classification.departmentIds.join(",") ||
    previous.topicLabels.join(",") !== input.classification.topicLabels.join(",");

  if (input.title && changed) {
    const source = input.source ?? "entry_reclassify";
    if (source === "auto_classify" || source === "training_apply") {
      return { ok: true };
    }

    await recordCaraKnowledgeEvent(supabase, {
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      eventType: "edited",
      category: input.category ?? null,
      title: input.title,
      payload: {
        action: "reclassified",
        entry_id: input.entryId,
        from_folder_id: previous?.folderId ?? null,
        to_folder_id: input.classification.folderId,
        department_ids: input.classification.departmentIds,
        topic_labels: input.classification.topicLabels,
      },
      source,
    });
  }

  return { ok: true };
}

export async function upsertKnowledgeFolderAssignment(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    entryId: string;
    folderId: string;
    departmentIds?: string[];
    topicLabels?: string[];
    actorId?: string | null;
    title?: string;
    category?: string | null;
    previousFolderId?: string | null;
    source?: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  return upsertKnowledgeEntryClassification(supabase, {
    organizationId: input.organizationId,
    entryId: input.entryId,
    classification: {
      folderId: input.folderId,
      departmentIds: input.departmentIds ?? [],
      topicLabels: input.topicLabels ?? [],
    },
    actorId: input.actorId,
    title: input.title,
    category: input.category,
    previousClassification: input.previousFolderId
      ? { folderId: input.previousFolderId, departmentIds: [], topicLabels: [] }
      : null,
    source: input.source,
  });
}

export async function deleteKnowledgeFolderAssignment(
  supabase: SupabaseClient,
  organizationId: string,
  entryId: string,
): Promise<void> {
  await supabase
    .from("cara_knowledge_folder_assignments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("entry_id", entryId);
}

function patchToText(patch: CaraTrainingPatch): string {
  if (patch.kind === "faq") return `${patch.question}\n${patch.answer}`;
  if (patch.kind === "service_not_offered") return patch.label;
  if (patch.kind === "business_rule") return patch.rule;
  return "";
}

async function loadKnowledgeFoldersForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ReturnType<typeof buildKnowledgeFolders>> {
  const [{ data: org }, { data: storeDepartments }] = await Promise.all([
    supabase
      .from("organizations")
      .select("agent_services_departments")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("store_departments")
      .select("name, active")
      .eq("organization_id", organizationId),
  ]);

  return buildKnowledgeFolders({
    storeDepartmentNames: (storeDepartments ?? [])
      .filter((row) => row.active)
      .map((row) => String(row.name)),
    serviceDepartmentNames: parseServiceDepartmentNames(
      org?.agent_services_departments,
    ),
  });
}

function classificationForAppliedTraining(
  patch: CaraTrainingPatch,
  folderId: string,
  folders: ReturnType<typeof buildKnowledgeFolders>,
  explicit?: EntryClassification,
): EntryClassification {
  const suggested = suggestKnowledgeAssignment(patchToText(patch), folders);

  if (explicit) {
    if (explicit.folderId === GENERAL_KNOWLEDGE_FOLDER_ID) {
      return {
        folderId: explicit.folderId,
        departmentIds: [],
        topicLabels:
          explicit.topicLabels.length > 0
            ? explicit.topicLabels
            : suggested.topicLabels,
      };
    }
    if (explicit.folderId === "unsorted") {
      return { folderId: explicit.folderId, departmentIds: [], topicLabels: [] };
    }
    return {
      folderId: explicit.folderId,
      departmentIds:
        explicit.departmentIds.length > 0
          ? explicit.departmentIds
          : suggested.departmentIds.length > 0
            ? suggested.departmentIds
            : [explicit.folderId],
      topicLabels: [],
    };
  }

  if (folderId === GENERAL_KNOWLEDGE_FOLDER_ID) {
    return {
      folderId,
      departmentIds: [],
      topicLabels: suggested.topicLabels,
    };
  }
  if (folderId === "unsorted") {
    return { folderId, departmentIds: [], topicLabels: [] };
  }
  return {
    folderId,
    departmentIds:
      suggested.departmentIds.length > 0 ? suggested.departmentIds : [folderId],
    topicLabels: [],
  };
}

export async function assignFolderForAppliedTraining(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    itemId: string;
    patch: CaraTrainingPatch;
    folderId: string | null | undefined;
    departmentIds?: string[];
    topicLabels?: string[];
    actorId: string;
  },
): Promise<void> {
  if (!input.folderId) return;
  const entryId = entryIdForTrainingPatch(input.itemId, input.patch);
  const folders = await loadKnowledgeFoldersForOrg(supabase, input.organizationId);
  const classification = classificationForAppliedTraining(
    input.patch,
    input.folderId,
    folders,
    {
      folderId: input.folderId,
      departmentIds: input.departmentIds ?? [],
      topicLabels: input.topicLabels ?? [],
    },
  );
  await upsertKnowledgeEntryClassification(supabase, {
    organizationId: input.organizationId,
    entryId,
    classification,
    actorId: input.actorId,
    title:
      input.patch.kind === "faq"
        ? input.patch.question
        : input.patch.kind === "business_rule"
          ? input.patch.rule
          : input.patch.label,
    category:
      input.patch.kind === "faq"
        ? "answers"
        : input.patch.kind === "business_rule"
          ? "policies"
          : "services",
    source: "training_apply",
  });
}

export async function setTrainingKnowledgeFolder(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  folderId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("cara_training_items")
    .update({
      knowledge_folder_id: folderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function setTrainingKnowledgeClassification(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  classification: EntryClassification,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("cara_training_items")
    .update({
      knowledge_folder_id: classification.folderId,
      knowledge_department_ids: classification.departmentIds,
      knowledge_topic_labels: classification.topicLabels,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
