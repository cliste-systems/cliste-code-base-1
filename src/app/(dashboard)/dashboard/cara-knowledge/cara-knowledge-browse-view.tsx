"use client";

import { useMemo } from "react";
import { BookOpen, MoreHorizontal } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_SELECT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  KnowledgeActiveTemporalNotice,
  KnowledgeTemporalBadge,
  KnowledgeTemporalStatusLine,
  knowledgeTemporalRowClass,
} from "@/components/cara-knowledge/knowledge-temporal-chrome";
import {
  dashboardQuickEnterVariants,
  dashboardStaggerVariants,
} from "@/components/dashboard/dashboard-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EntryClassification } from "@/lib/cara-knowledge-classification";
import {
  ALL_KNOWLEDGE_GROUP_ID,
  GENERAL_KNOWLEDGE_TOPICS,
} from "@/lib/cara-knowledge-topics";
import {
  buildKnowledgeGroupOptions,
  filterBrowseEntries,
  type KnowledgeBrowseFilters,
} from "@/lib/cara-knowledge-classification";
import type { CaraKnowledgeEntry } from "@/lib/cara-knowledge-index";
import {
  entryPreviewBody,
  GENERAL_KNOWLEDGE_FOLDER_ID,
  selectableKnowledgeFolders,
  UNSORTED_KNOWLEDGE_FOLDER_ID,
  type KnowledgeFolder,
  type KnowledgeFolderSort,
} from "@/lib/cara-knowledge-folders";
import { cn } from "@/lib/utils";

function formatEntryDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function KnowledgeBrowseView({
  entries,
  folders,
  classifications,
  legacyAssignments,
  canManage,
  filters,
  onOpenEntry,
  onUnlearnEntry,
  onOpenLinkedTemporal,
}: {
  entries: CaraKnowledgeEntry[];
  folders: KnowledgeFolder[];
  classifications: Map<string, EntryClassification>;
  legacyAssignments: Map<string, string>;
  canManage: boolean;
  filters: KnowledgeBrowseFilters;
  onOpenEntry: (entry: CaraKnowledgeEntry) => void;
  onUnlearnEntry: (entry: CaraKnowledgeEntry) => void;
  onOpenLinkedTemporal?: (updateId: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const groupOptions = useMemo(
    () =>
      buildKnowledgeGroupOptions(
        entries,
        folders,
        classifications,
        legacyAssignments,
      ),
    [classifications, entries, folders, legacyAssignments],
  );

  const visible = useMemo(
    () =>
      filterBrowseEntries(
        entries,
        folders,
        classifications,
        legacyAssignments,
        filters,
      ),
    [classifications, entries, filters, folders, legacyAssignments],
  );

  const List = reduceMotion ? "ul" : motion.ul;
  const ListItem = reduceMotion ? "li" : motion.li;
  const listMotion = reduceMotion
    ? {}
    : {
        variants: dashboardStaggerVariants,
        initial: "hidden" as const,
        animate: "show" as const,
      };
  const itemMotion = reduceMotion ? {} : { variants: dashboardQuickEnterVariants };

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No saved knowledge yet"
        description="Use Teach Cara above to add answers Cara can use on calls."
        className="py-12"
      />
    );
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No matches"
        description="Try a different search term."
        className="py-12"
      />
    );
  }

  return (
    <List className="divide-y divide-[#e3e9e5]" {...listMotion}>
      {visible.map((entry) => (
          <ListItem key={entry.id} {...itemMotion}>
            <KnowledgeEntryRow
              entry={entry}
              canManage={canManage}
              onOpen={() => onOpenEntry(entry)}
              onUnlearn={() => onUnlearnEntry(entry)}
              onOpenLinkedTemporal={onOpenLinkedTemporal}
            />
          </ListItem>
        ))}
    </List>
  );
}

export function KnowledgeBrowseFiltersBar({
  groupOptions,
  filters,
  onGroupChange,
  onSortChange,
}: {
  groupOptions: ReturnType<typeof buildKnowledgeGroupOptions>;
  filters: KnowledgeBrowseFilters;
  onGroupChange: (groupId: string) => void;
  onSortChange: (sort: KnowledgeFolderSort) => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-[#dfe7e2] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
      <label className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[12rem] sm:max-w-xs">
        <span className="text-[11px] font-medium text-[#6b7c75]">Group</span>
        <select
          value={filters.groupId}
          onChange={(event) => onGroupChange(event.target.value)}
          className={cn(DASHBOARD_SELECT_CLASS, "cursor-pointer bg-white text-[13px]")}
          aria-label="Filter by group"
        >
          {groupOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
              {option.id !== ALL_KNOWLEDGE_GROUP_ID ? ` (${option.count})` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex shrink-0 flex-col gap-1 sm:ml-auto">
        <span className="text-[11px] font-medium text-[#6b7c75]">Sort</span>
        <select
          value={filters.sort}
          onChange={(event) => onSortChange(event.target.value as KnowledgeFolderSort)}
          className={cn(
            DASHBOARD_SELECT_CLASS,
            "min-w-[9.5rem] cursor-pointer bg-white text-[13px]",
          )}
          aria-label="Sort knowledge entries"
        >
          <option value="az">A–Z</option>
          <option value="updated">Recently updated</option>
        </select>
      </label>
    </div>
  );
}

export function KnowledgeAssignmentFields({
  folders,
  value,
  onChange,
  idPrefix,
}: {
  folders: KnowledgeFolder[];
  value: EntryClassification;
  onChange: (next: EntryClassification) => void;
  idPrefix: string;
}) {
  const groupOptions = selectableKnowledgeFolders(folders);
  const departmentOptions = folders.filter((folder) => folder.kind === "department");
  const isGeneral = value.folderId === GENERAL_KNOWLEDGE_FOLDER_ID;
  const isNeedsSorting = value.folderId === UNSORTED_KNOWLEDGE_FOLDER_ID;
  const isDepartment =
    !isGeneral &&
    !isNeedsSorting &&
    folders.some((folder) => folder.id === value.folderId);

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5" htmlFor={`${idPrefix}-group`}>
        <span className="text-[12px] font-medium text-[#35443f]">Save to group</span>
        <select
          id={`${idPrefix}-group`}
          value={value.folderId}
          onChange={(event) => {
            const folderId = event.target.value;
            onChange({
              folderId,
              departmentIds:
                folderId !== GENERAL_KNOWLEDGE_FOLDER_ID &&
                folderId !== UNSORTED_KNOWLEDGE_FOLDER_ID
                  ? [folderId]
                  : [],
              topicLabels:
                folderId === GENERAL_KNOWLEDGE_FOLDER_ID ? value.topicLabels : [],
            });
          }}
          className={cn(DASHBOARD_INPUT_CLASS, "h-10 w-full bg-white px-3 text-[13px]")}
        >
          {groupOptions.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.label}
            </option>
          ))}
        </select>
      </label>

      {isGeneral ? (
        <fieldset className="space-y-2">
          <legend className="text-[12px] font-medium text-[#35443f]">Topics</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {GENERAL_KNOWLEDGE_TOPICS.map((topic) => {
              const checked = value.topicLabels.includes(topic.id);
              return (
                <label
                  key={topic.id}
                  className="flex items-center gap-2 text-[12px] text-[#35443f]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const topicLabels = event.target.checked
                        ? [...value.topicLabels, topic.id]
                        : value.topicLabels.filter((row) => row !== topic.id);
                      onChange({ ...value, topicLabels });
                    }}
                    className="size-4 rounded border-[#b9c8c1]"
                  />
                  {topic.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {isDepartment && departmentOptions.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-[12px] font-medium text-[#35443f]">
            Related departments
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {departmentOptions.map((folder) => {
              const checked =
                value.departmentIds.includes(folder.id) ||
                value.folderId === folder.id;
              return (
                <label
                  key={folder.id}
                  className="flex items-center gap-2 text-[12px] text-[#35443f]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      let departmentIds = [...value.departmentIds];
                      if (event.target.checked) {
                        if (!departmentIds.includes(folder.id)) {
                          departmentIds.push(folder.id);
                        }
                      } else {
                        departmentIds = departmentIds.filter((id) => id !== folder.id);
                      }
                      if (departmentIds.length === 0) {
                        departmentIds = [value.folderId];
                      }
                      onChange({
                        ...value,
                        departmentIds,
                        folderId: departmentIds[0] ?? value.folderId,
                      });
                    }}
                    className="size-4 rounded border-[#b9c8c1]"
                  />
                  {folder.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

export function KnowledgeEntryRow({
  entry,
  canManage,
  onOpen,
  onUnlearn,
  onOpenLinkedTemporal,
}: {
  entry: CaraKnowledgeEntry;
  canManage: boolean;
  onOpen: () => void;
  onUnlearn: () => void;
  onOpenLinkedTemporal?: (updateId: string) => void;
}) {
  const updated = formatEntryDate(entry.updatedAt);

  return (
    <div className="flex items-stretch gap-1 px-1 py-1 sm:px-2">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex min-w-0 flex-1 items-start justify-between gap-3 rounded-lg px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11181d] focus-visible:ring-offset-2",
          entry.temporal
            ? cn(knowledgeTemporalRowClass(entry), "hover:bg-[#eef2f5]")
            : "hover:bg-[#f7faf8]",
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-[#0b1220]">{entry.title}</p>
            <KnowledgeTemporalBadge entry={entry} />
          </div>
          <KnowledgeTemporalStatusLine entry={entry} className="mt-1" />
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-500">
            {entryPreviewBody(entry)}
          </p>
          <KnowledgeActiveTemporalNotice
            entry={entry}
            onOpenLinked={
              entry.linkedTemporalUpdateId && onOpenLinkedTemporal
                ? () => onOpenLinkedTemporal(entry.linkedTemporalUpdateId!)
                : undefined
            }
          />
        </div>
        {updated ? (
          <span className="shrink-0 text-[11px] text-[#8da198]">{updated}</span>
        ) : null}
      </button>
      {canManage ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#6b7c75] outline-none transition-colors hover:border-[#d9e2dd] hover:bg-white focus-visible:border-[#11181d] focus-visible:ring-1 focus-visible:ring-[#11181d]"
            aria-label={`Actions for ${entry.title}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {entry.editHref ? (
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = entry.editHref!;
                }}
              >
                {entry.editLabel ?? "Edit"}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={onUnlearn}>
              {entry.temporal ? "End now" : "Unlearn"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
