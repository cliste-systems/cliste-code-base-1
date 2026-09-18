import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  entryNeedsSorting,
  suggestClassificationForEntry,
  type EntryClassification,
} from "@/lib/cara-knowledge-classification";
import type { CaraKnowledgeEntry } from "@/lib/cara-knowledge-index";
import {
  loadKnowledgeEntryClassifications,
  loadKnowledgeFolderAssignments,
  upsertKnowledgeEntryClassification,
} from "@/lib/cara-knowledge-folder-assignments";
import {
  UNSORTED_KNOWLEDGE_FOLDER_ID,
  type KnowledgeFolder,
} from "@/lib/cara-knowledge-folders";

/** Persist Cara's suggested group/topics for entries still marked needs sorting. */
export async function autoApplySuggestedKnowledgeClassifications(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    entries: CaraKnowledgeEntry[];
    folders: KnowledgeFolder[];
  },
): Promise<Map<string, EntryClassification>> {
  const classifications = await loadKnowledgeEntryClassifications(
    supabase,
    input.organizationId,
  );
  const legacyAssignments = await loadKnowledgeFolderAssignments(
    supabase,
    input.organizationId,
  );

  for (const entry of input.entries) {
    if (
      !entryNeedsSorting(
        entry,
        input.folders,
        classifications,
        legacyAssignments,
      )
    ) {
      continue;
    }

    const suggested = suggestClassificationForEntry(entry, input.folders);
    if (suggested.folderId === UNSORTED_KNOWLEDGE_FOLDER_ID) {
      continue;
    }

    const previous = classifications.get(entry.id) ?? null;
    const result = await upsertKnowledgeEntryClassification(supabase, {
      organizationId: input.organizationId,
      entryId: entry.id,
      classification: suggested,
      previousClassification: previous,
      source: "auto_classify",
    });

    if (result.ok) {
      classifications.set(entry.id, suggested);
    }
  }

  return classifications;
}
