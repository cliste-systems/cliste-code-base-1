import type { CaraKnowledgeEntry } from "@/lib/cara-knowledge-index";
import { knowledgeEntriesForBrowse } from "@/lib/cara-knowledge-index";
import type { CaraTrainingPatch } from "@/lib/cara-training-types";
import {
  GENERAL_KNOWLEDGE_FOLDER_ID,
  UNSORTED_KNOWLEDGE_FOLDER_ID,
  folderById,
  folderLabelById,
  inferKnowledgeFolderId,
  resolveEntryFolderId,
  sortFolderEntries,
  searchFolderEntries,
  type KnowledgeFolder,
  type KnowledgeFolderSort,
} from "@/lib/cara-knowledge-folders";
import {
  ALL_KNOWLEDGE_GROUP_ID,
  GENERAL_KNOWLEDGE_TOPICS,
  generalTopicLabel,
  type GeneralKnowledgeTopicId,
} from "@/lib/cara-knowledge-topics";
import { RETAIL_DEPARTMENTS } from "@/lib/retail-department-pack";

export type EntryClassification = {
  folderId: string;
  departmentIds: string[];
  topicLabels: string[];
};

export type KnowledgeBrowseFilters = {
  groupId: string;
  topicId: string | null;
  query: string;
  sort: KnowledgeFolderSort;
};

export type KnowledgeGroupOption = {
  id: string;
  label: string;
  count: number;
};

export type SuggestedKnowledgeAssignment = {
  folderId: string;
  departmentIds: string[];
  topicLabels: GeneralKnowledgeTopicId[];
  summary: string;
};

function normalizeDepartmentIds(
  ids: string[],
  folders: KnowledgeFolder[],
): string[] {
  const valid = new Set(
    folders.filter((folder) => folder.kind === "department").map((folder) => folder.id),
  );
  return [...new Set(ids.filter((id) => valid.has(id)))];
}

/** Avoid substring false positives such as matching Deli inside deliver/delivery. */
function classificationTextIncludesTerm(text: string, term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;
  const lower = text.toLowerCase();
  const needle = trimmed.toLowerCase();
  if (/\s/.test(needle)) {
    return lower.includes(needle);
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function normalizeTopicLabels(labels: string[]): GeneralKnowledgeTopicId[] {
  const valid = new Set(GENERAL_KNOWLEDGE_TOPICS.map((topic) => topic.id));
  return labels.filter((label): label is GeneralKnowledgeTopicId =>
    valid.has(label as GeneralKnowledgeTopicId),
  );
}

export function resolvePersistedClassification(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
  persisted: EntryClassification | undefined,
): EntryClassification {
  if (persisted) {
    const folderId = persisted.folderId;
    const departmentIds = normalizeDepartmentIds(persisted.departmentIds, folders);
    const topicLabels =
      folderId === GENERAL_KNOWLEDGE_FOLDER_ID
        ? normalizeTopicLabels(persisted.topicLabels)
        : [];
    return { folderId, departmentIds, topicLabels };
  }

  const folderId = inferKnowledgeFolderId(entry, folders);
  const departmentIds =
    folderId !== GENERAL_KNOWLEDGE_FOLDER_ID &&
    folderId !== UNSORTED_KNOWLEDGE_FOLDER_ID
      ? [folderId]
      : inferDepartmentIdsFromText(`${entry.title}\n${entry.body}`, folders);
  return {
    folderId,
    departmentIds: normalizeDepartmentIds(departmentIds, folders),
    topicLabels:
      folderId === GENERAL_KNOWLEDGE_FOLDER_ID
        ? inferTopicLabelsFromEntry(entry)
        : [],
  };
}

export function suggestClassificationForEntry(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
): EntryClassification {
  const suggestion = suggestKnowledgeAssignment(
    `${entry.title}\n${entry.body}`,
    folders,
  );
  if (suggestion.folderId !== UNSORTED_KNOWLEDGE_FOLDER_ID) {
    return {
      folderId: suggestion.folderId,
      departmentIds: suggestion.departmentIds,
      topicLabels: suggestion.topicLabels,
    };
  }

  const topicLabels = inferTopicLabelsFromEntry(entry);
  if (topicLabels.length > 0) {
    return {
      folderId: GENERAL_KNOWLEDGE_FOLDER_ID,
      departmentIds: [],
      topicLabels,
    };
  }

  if (entry.id === "fact-summary") {
    return {
      folderId: GENERAL_KNOWLEDGE_FOLDER_ID,
      departmentIds: [],
      topicLabels: [],
    };
  }

  return {
    folderId: UNSORTED_KNOWLEDGE_FOLDER_ID,
    departmentIds: [],
    topicLabels: [],
  };
}

export function suggestClassificationForTrainingPatch(
  patch: CaraTrainingPatch,
  folders: KnowledgeFolder[],
): EntryClassification {
  const text =
    patch.kind === "faq"
      ? `${patch.question}\n${patch.answer}`
      : patch.kind === "business_rule"
        ? patch.rule
        : patch.label;
  return suggestClassificationForEntry(
    {
      id: "training-draft",
      category: "answers",
      title: text.split("\n")[0] ?? text,
      body: text,
      source: "training_applied",
    },
    folders,
  );
}

export function trainingItemClassificationDraft(
  item: {
    knowledge_folder_id?: string | null;
    knowledge_department_ids?: string[];
    knowledge_topic_labels?: string[];
    proposed_patch?: CaraTrainingPatch | null;
  },
  folders: KnowledgeFolder[],
): EntryClassification {
  if (item.knowledge_folder_id) {
    return {
      folderId: item.knowledge_folder_id,
      departmentIds: item.knowledge_department_ids ?? [],
      topicLabels: item.knowledge_topic_labels ?? [],
    };
  }
  if (item.proposed_patch) {
    return suggestClassificationForTrainingPatch(item.proposed_patch, folders);
  }
  return {
    folderId: UNSORTED_KNOWLEDGE_FOLDER_ID,
    departmentIds: [],
    topicLabels: [],
  };
}

export function hasPersistedAssignment(
  entryId: string,
  classifications: Map<string, EntryClassification>,
  legacyAssignments: Map<string, string>,
): boolean {
  return classifications.has(entryId) || legacyAssignments.has(entryId);
}

/** Labels and browse chrome — persisted assignment, otherwise heuristic suggestion. */
export function resolveDisplayClassification(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
  classifications: Map<string, EntryClassification>,
  legacyAssignments: Map<string, string>,
): EntryClassification {
  const persisted = classifications.get(entry.id);
  if (persisted) {
    return resolvePersistedClassification(entry, folders, persisted);
  }
  const legacyFolderId = legacyAssignments.get(entry.id);
  if (legacyFolderId) {
    return resolvePersistedClassification(entry, folders, {
      folderId: legacyFolderId,
      departmentIds: [],
      topicLabels: [],
    });
  }
  return suggestClassificationForEntry(entry, folders);
}

/** Filter/group matching — only persisted assignments count outside Needs sorting. */
export function resolveFilterClassification(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
  classifications: Map<string, EntryClassification>,
  legacyAssignments: Map<string, string>,
): EntryClassification | null {
  const persisted = classifications.get(entry.id);
  if (persisted) {
    return resolvePersistedClassification(entry, folders, persisted);
  }
  const legacyFolderId = legacyAssignments.get(entry.id);
  if (legacyFolderId) {
    return resolvePersistedClassification(entry, folders, {
      folderId: legacyFolderId,
      departmentIds: [],
      topicLabels: [],
    });
  }
  return null;
}

export function resolveEntryFolderIdFromClassification(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
  classifications: Map<string, EntryClassification>,
  legacyAssignments: Map<string, string>,
): string {
  const persisted = classifications.get(entry.id);
  if (persisted) {
    return persisted.folderId;
  }
  return resolveEntryFolderId(entry, folders, legacyAssignments);
}

export function entryNeedsSorting(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
  classifications: Map<string, EntryClassification>,
  legacyAssignments: Map<string, string>,
): boolean {
  if (hasPersistedAssignment(entry.id, classifications, legacyAssignments)) {
    const classification = resolveFilterClassification(
      entry,
      folders,
      classifications,
      legacyAssignments,
    );
    return classification?.folderId === UNSORTED_KNOWLEDGE_FOLDER_ID;
  }
  return true;
}

export function formatSuggestedAssignmentSummary(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
): string | null {
  const suggestion = suggestClassificationForEntry(entry, folders);
  if (suggestion.folderId === UNSORTED_KNOWLEDGE_FOLDER_ID) {
    return null;
  }
  return suggestKnowledgeAssignment(
    `${entry.title}\n${entry.body}`,
    folders,
  ).summary;
}

export function entryDepartmentIds(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
  classification: EntryClassification,
): string[] {
  if (classification.departmentIds.length > 0) {
    return classification.departmentIds;
  }
  if (
    classification.folderId !== GENERAL_KNOWLEDGE_FOLDER_ID &&
    classification.folderId !== UNSORTED_KNOWLEDGE_FOLDER_ID &&
    folders.some((folder) => folder.id === classification.folderId)
  ) {
    return [classification.folderId];
  }
  return inferDepartmentIdsFromText(`${entry.title}\n${entry.body}`, folders);
}

export function inferDepartmentIdsFromText(
  text: string,
  folders: KnowledgeFolder[],
): string[] {
  const lower = text.toLowerCase();
  const ids = new Set<string>();

  for (const folder of folders) {
    if (folder.kind !== "department") continue;
    if (classificationTextIncludesTerm(lower, folder.label)) {
      ids.add(folder.id);
    }
  }

  for (const dept of RETAIL_DEPARTMENTS) {
    for (const alias of dept.storeDepartmentNames ?? []) {
      if (!classificationTextIncludesTerm(lower, alias)) continue;
      const configured = folders.find(
        (folder) =>
          folder.id === dept.slug ||
          folder.label.trim().toLowerCase() === alias.trim().toLowerCase(),
      );
      if (configured) {
        ids.add(configured.id);
      }
    }
  }

  for (const id of inferDepartmentIdsFromKeywords(text, folders)) {
    ids.add(id);
  }

  return normalizeDepartmentIds([...ids], folders);
}

const DEPARTMENT_CONTENT_HINTS: Record<string, string[]> = {
  bakery: ["cake", "bread", "bun", "pastry", "communion", "birthday"],
  deli: ["sandwich", "deli", "platter", "hot food"],
  "meat-counter": ["meat", "butcher", "lamb", "beef", "meat counter"],
  "fish-counter": ["fish", "seafood", "salmon"],
  "off-licence": ["wine", "beer", "off-licence", "off licence"],
};

function inferDepartmentIdsFromKeywords(
  text: string,
  folders: KnowledgeFolder[],
): string[] {
  const ids = new Set<string>();
  for (const folder of folders) {
    if (folder.kind !== "department") continue;
    const hints = DEPARTMENT_CONTENT_HINTS[folder.id] ?? [];
    if (hints.some((hint) => classificationTextIncludesTerm(text, hint))) {
      ids.add(folder.id);
    }
  }
  return [...ids];
}

export function inferTopicLabelsFromEntry(
  entry: CaraKnowledgeEntry,
): GeneralKnowledgeTopicId[] {
  if (entry.id === "fact-hours") return ["hours-location"];
  if (entry.id === "fact-about" || entry.id === "fact-area" || entry.id.startsWith("fact-town")) {
    return ["hours-location"];
  }
  if (entry.id.startsWith("temporal-")) {
    return ["hours-location"];
  }

  const text = `${entry.title}\n${entry.body}`.toLowerCase();
  const topics = new Set<GeneralKnowledgeTopicId>();

  if (/\b(atms?|toilets?|restrooms?|baby.?chang|wheelchair|accessible|disabilit)\b/.test(text)) {
    topics.add("facilities-accessibility");
  }
  if (/\b(park|parking)\b/.test(text)) {
    topics.add("parking");
  }
  if (/\b(gift card|payment|cash|card|deliver(?:y|ies)?|collection|click.?collect)\b/.test(text)) {
    topics.add("services-payments");
  }
  if (/\b(return|receipt|refund|pet|dog|lost property)\b/.test(text)) {
    topics.add("policies");
  }
  if (/\b(contact|supplier|manager|staff)\b/.test(text)) {
    topics.add("contact-people");
  }
  if (/\b(opening|open|hours?|holiday|address|direction|location|where|closing|closed|close)\b/.test(text)) {
    topics.add("hours-location");
  }

  return [...topics];
}

export function suggestKnowledgeAssignment(
  text: string,
  folders: KnowledgeFolder[],
): SuggestedKnowledgeAssignment {
  const trimmed = text.trim();
  const departmentIds = inferDepartmentIdsFromText(trimmed, folders);
  const topicLabels = inferTopicLabelsFromText(trimmed);

  if (departmentIds.length === 1) {
    const folder = folderById(folders, departmentIds[0]!);
    return {
      folderId: departmentIds[0]!,
      departmentIds,
      topicLabels: [],
      summary: folder?.label ?? "Department",
    };
  }

  if (departmentIds.length > 1) {
    const labels = departmentIds
      .map((id) => folderLabelById(folders, id))
      .join(" + ");
    return {
      folderId: departmentIds[0]!,
      departmentIds,
      topicLabels: [],
      summary: labels,
    };
  }

  if (topicLabels.length > 0) {
    const label = generalTopicLabel(topicLabels[0]!) ?? "General store information";
    return {
      folderId: GENERAL_KNOWLEDGE_FOLDER_ID,
      departmentIds: [],
      topicLabels,
      summary: `General store information → ${label}`,
    };
  }

  return {
    folderId: UNSORTED_KNOWLEDGE_FOLDER_ID,
    departmentIds: [],
    topicLabels: [],
    summary: "Needs sorting",
  };
}

function inferTopicLabelsFromText(text: string): GeneralKnowledgeTopicId[] {
  return inferTopicLabelsFromEntry({
    id: "draft",
    category: "answers",
    title: text,
    body: text,
    source: "faq",
  });
}

export function formatEntryGroupLabels(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
  classification: EntryClassification,
): string[] {
  const labels: string[] = [];
  const folderId = classification.folderId;

  if (folderId === GENERAL_KNOWLEDGE_FOLDER_ID) {
    labels.push("General store information");
    for (const topicId of classification.topicLabels) {
      const topic = generalTopicLabel(topicId);
      if (topic) labels.push(topic);
    }
    return labels.length > 1 ? labels : labels;
  }

  if (folderId === UNSORTED_KNOWLEDGE_FOLDER_ID) {
    labels.push("Needs sorting");
    return labels;
  }

  const departments = entryDepartmentIds(entry, folders, classification);
  if (departments.length > 0) {
    for (const id of departments) {
      const label = folderLabelById(folders, id);
      if (!labels.includes(label)) labels.push(label);
    }
    return labels;
  }

  labels.push(folderLabelById(folders, folderId));
  return labels;
}

export function buildKnowledgeGroupOptions(
  entries: CaraKnowledgeEntry[],
  folders: KnowledgeFolder[],
  classifications: Map<string, EntryClassification>,
  legacyAssignments: Map<string, string>,
): KnowledgeGroupOption[] {
  const browsableEntries = knowledgeEntriesForBrowse(entries);
  const counts = new Map<string, number>();
  counts.set(ALL_KNOWLEDGE_GROUP_ID, browsableEntries.length);
  counts.set(GENERAL_KNOWLEDGE_FOLDER_ID, 0);

  for (const folder of folders) {
    if (folder.kind === "department") counts.set(folder.id, 0);
  }

  let needsSortingCount = 0;

  for (const entry of browsableEntries) {
    const classification =
      resolveFilterClassification(
        entry,
        folders,
        classifications,
        legacyAssignments,
      ) ??
      suggestClassificationForEntry(entry, folders);
    if (
      entryNeedsSorting(entry, folders, classifications, legacyAssignments) ||
      classification.folderId === UNSORTED_KNOWLEDGE_FOLDER_ID
    ) {
      needsSortingCount += 1;
    }

    const persisted = resolveFilterClassification(
      entry,
      folders,
      classifications,
      legacyAssignments,
    );
    if (!persisted) continue;

    if (persisted.folderId === GENERAL_KNOWLEDGE_FOLDER_ID) {
      counts.set(
        GENERAL_KNOWLEDGE_FOLDER_ID,
        (counts.get(GENERAL_KNOWLEDGE_FOLDER_ID) ?? 0) + 1,
      );
    }

    for (const departmentId of entryDepartmentIds(entry, folders, persisted)) {
      counts.set(departmentId, (counts.get(departmentId) ?? 0) + 1);
    }
  }

  const options: KnowledgeGroupOption[] = [
    {
      id: ALL_KNOWLEDGE_GROUP_ID,
      label: "All knowledge",
      count: entries.length,
    },
    {
      id: GENERAL_KNOWLEDGE_FOLDER_ID,
      label: "General store information",
      count: counts.get(GENERAL_KNOWLEDGE_FOLDER_ID) ?? 0,
    },
  ];

  for (const folder of folders) {
    if (folder.kind !== "department") continue;
    options.push({
      id: folder.id,
      label: folder.label,
      count: counts.get(folder.id) ?? 0,
    });
  }

  if (needsSortingCount > 0) {
    options.push({
      id: UNSORTED_KNOWLEDGE_FOLDER_ID,
      label: "Needs sorting",
      count: needsSortingCount,
    });
  }

  return options;
}

function entryMatchesGroup(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
  classifications: Map<string, EntryClassification>,
  legacyAssignments: Map<string, string>,
  groupId: string,
): boolean {
  if (groupId === ALL_KNOWLEDGE_GROUP_ID) return true;

  if (groupId === UNSORTED_KNOWLEDGE_FOLDER_ID) {
    return entryNeedsSorting(entry, folders, classifications, legacyAssignments);
  }

  const classification = resolveFilterClassification(
    entry,
    folders,
    classifications,
    legacyAssignments,
  );
  if (!classification) return false;

  if (groupId === GENERAL_KNOWLEDGE_FOLDER_ID) {
    return classification.folderId === GENERAL_KNOWLEDGE_FOLDER_ID;
  }

  return entryDepartmentIds(entry, folders, classification).includes(groupId);
}

function entryMatchesTopic(
  classification: EntryClassification,
  topicId: string | null,
): boolean {
  if (!topicId) return true;
  if (classification.folderId !== GENERAL_KNOWLEDGE_FOLDER_ID) return false;
  return classification.topicLabels.includes(topicId as GeneralKnowledgeTopicId);
}

export function filterBrowseEntries(
  entries: CaraKnowledgeEntry[],
  folders: KnowledgeFolder[],
  classifications: Map<string, EntryClassification>,
  legacyAssignments: Map<string, string>,
  filters: KnowledgeBrowseFilters,
): CaraKnowledgeEntry[] {
  const filtered = knowledgeEntriesForBrowse(entries).filter((entry) => {
    const filterClassification = resolveFilterClassification(
      entry,
      folders,
      classifications,
      legacyAssignments,
    );
    if (
      !entryMatchesGroup(
        entry,
        folders,
        classifications,
        legacyAssignments,
        filters.groupId,
      )
    ) {
      return false;
    }
    if (filters.topicId) {
      if (!filterClassification) return false;
      if (!entryMatchesTopic(filterClassification, filters.topicId)) {
        return false;
      }
    }
    return true;
  });

  const searched = searchFolderEntries(filtered, filters.query);
  return sortFolderEntries(searched, filters.sort);
}
