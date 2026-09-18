import type { CaraTrainingPatch } from "@/lib/cara-training-types";
import type { CaraKnowledgeEntry } from "@/lib/cara-knowledge-index";
import { browseTemporalRank } from "@/lib/cara-knowledge-index";
import { knowledgeEntryIdForPatch } from "@/lib/cara-knowledge-index";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import { mapStoreDepartmentNameToSlug } from "@/lib/retail-department-pack";

export const GENERAL_KNOWLEDGE_FOLDER_ID = "general";
export const UNSORTED_KNOWLEDGE_FOLDER_ID = "unsorted";

export type KnowledgeFolderKind = "general" | "department" | "unsorted";

export type KnowledgeFolder = {
  id: string;
  label: string;
  kind: KnowledgeFolderKind;
};

export type KnowledgeFolderSummary = KnowledgeFolder & {
  entryCount: number;
  lastUpdatedAt: string | null;
};

export type KnowledgeFolderAssignment = {
  entryId: string;
  folderId: string;
  updatedAt: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function departmentFolderIdFromName(name: string): string {
  const mapped = mapStoreDepartmentNameToSlug(name);
  if (mapped && mapped !== "general") return mapped;
  const slug = slugify(name);
  return slug ? `dept-${slug}` : UNSORTED_KNOWLEDGE_FOLDER_ID;
}

export function buildKnowledgeFolders(input: {
  storeDepartmentNames: string[];
  serviceDepartmentNames: string[];
}): KnowledgeFolder[] {
  const folders: KnowledgeFolder[] = [
    {
      id: GENERAL_KNOWLEDGE_FOLDER_ID,
      label: "General store information",
      kind: "general",
    },
  ];

  const names = new Set<string>();
  for (const name of [
    ...input.storeDepartmentNames,
    ...input.serviceDepartmentNames,
  ]) {
    const trimmed = String(name ?? "").trim();
    if (trimmed) names.add(trimmed);
  }

  const departments = [...names]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((label) => ({
      id: departmentFolderIdFromName(label),
      label,
      kind: "department" as const,
    }));

  const seen = new Set<string>();
  for (const folder of departments) {
    if (seen.has(folder.id)) continue;
    seen.add(folder.id);
    folders.push(folder);
  }

  return folders;
}

export function unsortedKnowledgeFolder(): KnowledgeFolder {
  return {
    id: UNSORTED_KNOWLEDGE_FOLDER_ID,
    label: "Needs sorting",
    kind: "unsorted",
  };
}

export function folderById(
  folders: KnowledgeFolder[],
  folderId: string,
): KnowledgeFolder | null {
  if (folderId === UNSORTED_KNOWLEDGE_FOLDER_ID) {
    return unsortedKnowledgeFolder();
  }
  return folders.find((folder) => folder.id === folderId) ?? null;
}

export function folderLabelById(
  folders: KnowledgeFolder[],
  folderId: string,
): string {
  return folderById(folders, folderId)?.label ?? "Needs sorting";
}

function departmentFolderIdForExactTitle(
  title: string,
  folders: KnowledgeFolder[],
): string | null {
  const key = title.trim().toLowerCase();
  if (!key) return null;
  const match = folders.find(
    (folder) =>
      folder.kind === "department" && folder.label.trim().toLowerCase() === key,
  );
  return match?.id ?? null;
}

export function inferKnowledgeFolderId(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
): string {
  if (entry.source === "summary" || entry.id.startsWith("fact-")) {
    return GENERAL_KNOWLEDGE_FOLDER_ID;
  }

  if (entry.source === "rule") {
    return GENERAL_KNOWLEDGE_FOLDER_ID;
  }

  if (entry.category === "not-offered") {
    return (
      departmentFolderIdForExactTitle(entry.title, folders) ??
      UNSORTED_KNOWLEDGE_FOLDER_ID
    );
  }

  if (entry.source === "training_applied") {
    if (entry.category === "policies" || entry.category === "prices") {
      return GENERAL_KNOWLEDGE_FOLDER_ID;
    }
  }

  return UNSORTED_KNOWLEDGE_FOLDER_ID;
}

export function resolveEntryFolderId(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
  assignments: Map<string, string>,
): string {
  const assigned = assignments.get(entry.id);
  if (assigned) {
    if (
      assigned === GENERAL_KNOWLEDGE_FOLDER_ID ||
      assigned === UNSORTED_KNOWLEDGE_FOLDER_ID ||
      folders.some((folder) => folder.id === assigned)
    ) {
      return assigned;
    }
  }
  return inferKnowledgeFolderId(entry, folders);
}

export function groupEntriesByFolder(
  entries: CaraKnowledgeEntry[],
  folders: KnowledgeFolder[],
  assignments: Map<string, string>,
): Map<string, CaraKnowledgeEntry[]> {
  const grouped = new Map<string, CaraKnowledgeEntry[]>();
  for (const folder of folders) {
    grouped.set(folder.id, []);
  }
  grouped.set(UNSORTED_KNOWLEDGE_FOLDER_ID, []);

  for (const entry of entries) {
    const folderId = resolveEntryFolderId(entry, folders, assignments);
    const bucket = grouped.get(folderId) ?? grouped.get(UNSORTED_KNOWLEDGE_FOLDER_ID)!;
    bucket.push(entry);
    grouped.set(folderId, bucket);
  }

  return grouped;
}

export type KnowledgeFolderSort = "az" | "updated";

export function sortFolderEntries(
  entries: CaraKnowledgeEntry[],
  sort: KnowledgeFolderSort,
): CaraKnowledgeEntry[] {
  return [...entries].sort((a, b) => {
    const temporalDiff = browseTemporalRank(b) - browseTemporalRank(a);
    if (temporalDiff !== 0) return temporalDiff;

    if (sort === "updated") {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}

export function summarizeKnowledgeFolders(
  folders: KnowledgeFolder[],
  grouped: Map<string, CaraKnowledgeEntry[]>,
): KnowledgeFolderSummary[] {
  return folders.map((folder) => {
    const entries = grouped.get(folder.id) ?? [];
    const lastUpdatedAt = entries.reduce<string | null>((latest, entry) => {
      if (!entry.updatedAt) return latest;
      if (!latest) return entry.updatedAt;
      return new Date(entry.updatedAt).getTime() > new Date(latest).getTime()
        ? entry.updatedAt
        : latest;
    }, null);
    return {
      ...folder,
      entryCount: entries.length,
      lastUpdatedAt,
    };
  });
}

export function searchFolderEntries(
  entries: CaraKnowledgeEntry[],
  query: string,
): CaraKnowledgeEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((entry) => {
    const haystack = `${entry.title}\n${entry.body}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function entryIdForTrainingPatch(
  itemId: string,
  patch: CaraTrainingPatch,
): string {
  return knowledgeEntryIdForPatch(itemId, patch);
}

export function parseServiceDepartmentNames(
  servicesOffered: string | null | undefined,
): string[] {
  return parseAgentKnowledgeList(String(servicesOffered ?? ""));
}

export function selectableKnowledgeFolders(
  folders: KnowledgeFolder[],
): KnowledgeFolder[] {
  return [
    ...folders.filter((folder) => folder.kind !== "unsorted"),
    unsortedKnowledgeFolder(),
  ];
}

export function formatFolderUpdatedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function entryHasQuestionAndAnswer(entry: CaraKnowledgeEntry): boolean {
  if (entry.source === "faq") return true;
  if (entry.category !== "answers" && entry.category !== "prices") return false;
  const question = entry.title.trim();
  const answer = entry.body.trim();
  return question.length > 0 && answer.length > 0 && question !== answer;
}

export function entryPreviewBody(entry: CaraKnowledgeEntry): string {
  const body = entry.body.trim();
  if (!body) return entry.title;
  if (
    body === "Service or department Cara can mention on calls." ||
    body === "Cara should say you do not offer this." ||
    body === "Business rule Cara follows on calls." ||
    body === "Learned from a call or your teaching." ||
    body === "Learned business rule."
  ) {
    return entry.title;
  }
  return body;
}
