import "server-only";

import type { EntryClassification } from "@/lib/cara-knowledge-classification";
import {
  buildKnowledgeFolders,
  groupEntriesByFolder,
  summarizeKnowledgeFolders,
  parseServiceDepartmentNames,
  type KnowledgeFolder,
} from "@/lib/cara-knowledge-folders";
import { loadKnowledgeEntryClassifications } from "@/lib/cara-knowledge-folder-assignments";
import type { CaraKnowledgeIndex } from "@/lib/cara-knowledge-index";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";

export type CaraKnowledgeFolderPageData = {
  folders: KnowledgeFolder[];
  folderSummaries: ReturnType<typeof summarizeKnowledgeFolders>;
  assignments: Record<string, string>;
  classifications: Record<string, EntryClassification>;
};

export async function buildCaraKnowledgeFolderViewModel(input: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  organizationId: string;
  index: CaraKnowledgeIndex;
  servicesOffered: string | null | undefined;
  storeDepartments: Pick<StoreDepartmentRow, "name" | "active">[];
}): Promise<CaraKnowledgeFolderPageData> {
  const classifications = await loadKnowledgeEntryClassifications(
    input.supabase,
    input.organizationId,
  );

  const assignments = new Map(
    [...classifications.entries()].map(([entryId, value]) => [
      entryId,
      value.folderId,
    ]),
  );

  const storeDepartmentNames = input.storeDepartments
    .filter((row) => row.active)
    .map((row) => row.name);

  const folders = buildKnowledgeFolders({
    storeDepartmentNames,
    serviceDepartmentNames: parseServiceDepartmentNames(input.servicesOffered),
  });

  const grouped = groupEntriesByFolder(input.index.entries, folders, assignments);
  const folderSummaries = summarizeKnowledgeFolders(folders, grouped);

  return {
    folders,
    folderSummaries,
    assignments: Object.fromEntries(assignments),
    classifications: Object.fromEntries(classifications),
  };
}
