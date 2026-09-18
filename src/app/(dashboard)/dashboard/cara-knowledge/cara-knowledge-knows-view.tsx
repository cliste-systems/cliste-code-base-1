"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  Folder,
  FolderOpen,
  Inbox,
  Loader2,
  MoreHorizontal,
  Search,
  Store,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { moveKnowledgeEntry } from "@/app/(dashboard)/dashboard/cara-knowledge/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HOME_PANEL_ACTION_BUTTON_CLASS,
  DASHBOARD_INPUT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  dashboardQuickEnterVariants,
  dashboardStaggerVariants,
} from "@/components/dashboard/dashboard-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { CaraKnowledgeEntry } from "@/lib/cara-knowledge-index";
import {
  formatFolderUpdatedLabel,
  entryPreviewBody,
  folderById,
  folderLabelById,
  resolveEntryFolderId,
  searchFolderEntries,
  sortFolderEntries,
  selectableKnowledgeFolders,
  unsortedKnowledgeFolder,
  UNSORTED_KNOWLEDGE_FOLDER_ID,
  type KnowledgeFolder,
  type KnowledgeFolderSort,
  type KnowledgeFolderSummary,
} from "@/lib/cara-knowledge-folders";
import { cn } from "@/lib/utils";

function folderIcon(folder: KnowledgeFolder) {
  if (folder.kind === "general") return Store;
  if (folder.kind === "unsorted") return Inbox;
  return Folder;
}

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

export function KnowledgeFolderGrid({
  summaries,
  onOpenFolder,
}: {
  summaries: KnowledgeFolderSummary[];
  onOpenFolder: (folderId: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const unsortedCount =
    summaries.find((row) => row.id === UNSORTED_KNOWLEDGE_FOLDER_ID)?.entryCount ?? 0;
  const visible = summaries.filter(
    (folder) =>
      folder.kind !== "unsorted" ||
      (folder.kind === "unsorted" && unsortedCount > 0),
  );

  const Grid = reduceMotion ? "div" : motion.div;
  const GridItem = reduceMotion ? "div" : motion.div;
  const gridMotion = reduceMotion
    ? {}
    : {
        variants: dashboardStaggerVariants,
        initial: "hidden" as const,
        animate: "show" as const,
      };
  const itemMotion = reduceMotion ? {} : { variants: dashboardQuickEnterVariants };

  return (
    <Grid
      className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3"
      {...gridMotion}
    >
      {visible.map((folder) => {
        const Icon = folderIcon(folder);
        const updated = formatFolderUpdatedLabel(folder.lastUpdatedAt);
        return (
          <GridItem key={folder.id} {...itemMotion}>
            <button
              type="button"
              onClick={() => onOpenFolder(folder.id)}
              className={cn(
                DASHBOARD_CARD_SURFACE,
                "group flex min-h-[7.5rem] w-full flex-col gap-3 p-4 text-left transition hover:border-[#9da9a4] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11181d] focus-visible:ring-offset-2",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] text-[#353D42]">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-[11px] font-medium tabular-nums text-[#6b7c75]">
                  {folder.entryCount}{" "}
                  {folder.entryCount === 1 ? "entry" : "entries"}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-[#11181d] group-hover:text-[#0b1220]">
                  {folder.label}
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-[#6b7c75]">
                  {folder.entryCount === 0
                    ? "No knowledge added yet"
                    : updated
                      ? `Updated ${updated}`
                      : "Knowledge saved"}
                </p>
              </div>
            </button>
          </GridItem>
        );
      })}
    </Grid>
  );
}

export function KnowledgeFolderDetail({
  folder,
  entries,
  folders,
  canManage,
  onBack,
  onOpenEntry,
  onUnlearnEntry,
  onMoveEntry,
}: {
  folder: KnowledgeFolder;
  entries: CaraKnowledgeEntry[];
  folders: KnowledgeFolder[];
  canManage: boolean;
  onBack: () => void;
  onOpenEntry: (entry: CaraKnowledgeEntry) => void;
  onUnlearnEntry: (entry: CaraKnowledgeEntry) => void;
  onMoveEntry: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [folderQuery, setFolderQuery] = useState("");
  const [sort, setSort] = useState<KnowledgeFolderSort>("az");

  const filtered = useMemo(() => {
    const searched = searchFolderEntries(entries, folderQuery);
    return sortFolderEntries(searched, sort);
  }, [entries, folderQuery, sort]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[#dfe7e2] px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            DASHBOARD_HOME_PANEL_ACTION_BUTTON_CLASS,
            "mb-3 inline-flex h-9 items-center gap-1 px-3 text-[12.5px] font-medium text-[#35443f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11181d] focus-visible:ring-offset-2",
          )}
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          All folders
        </button>

        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold text-[#11181d]">{folder.label}</h2>
          <p className="mt-1 text-[12px] text-[#6b7c75]">
            {entries.length}{" "}
            {entries.length === 1 ? "saved answer" : "saved answers"}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              type="search"
              value={folderQuery}
              onChange={(event) => setFolderQuery(event.target.value)}
              placeholder={`Search in ${folder.label}…`}
              aria-label={`Search in ${folder.label}`}
              className={cn(
                DASHBOARD_INPUT_CLASS,
                "h-10 w-full bg-white py-1 pl-9 text-[13px] placeholder:text-slate-400",
              )}
            />
          </label>
          <label className="flex shrink-0 items-center gap-2 text-[12px] text-[#6b7c75]">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as KnowledgeFolderSort)}
              className={cn(
                DASHBOARD_INPUT_CLASS,
                "h-10 min-w-[9.5rem] bg-white px-3 text-[13px]",
              )}
              aria-label="Sort knowledge entries"
            >
              <option value="az">A–Z</option>
              <option value="updated">Recently updated</option>
            </select>
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={
              folderQuery.trim()
                ? `No matches in ${folder.label}`
                : "No knowledge in this folder yet"
            }
            description={
              folderQuery.trim()
                ? "Try a different search term or clear the search."
                : "Use Teach Cara above to add knowledge for this area."
            }
            className="py-12"
          />
        ) : (
          <List className="divide-y divide-[#e3e9e5]" {...listMotion}>
            {filtered.map((entry) => (
              <ListItem key={entry.id} {...itemMotion}>
                <KnowledgeEntryRow
                  entry={entry}
                  folders={folders}
                  canManage={canManage}
                  onOpen={() => onOpenEntry(entry)}
                  onUnlearn={() => onUnlearnEntry(entry)}
                  onMoved={onMoveEntry}
                />
              </ListItem>
            ))}
          </List>
        )}
      </div>
    </div>
  );
}

export function KnowledgeEntryRow({
  entry,
  folders,
  canManage,
  onOpen,
  onUnlearn,
  onMoved,
  folderLabel,
}: {
  entry: CaraKnowledgeEntry;
  folders: KnowledgeFolder[];
  canManage: boolean;
  onOpen: () => void;
  onUnlearn: () => void;
  onMoved?: () => void;
  folderLabel?: string;
}) {
  const [movePending, startMoveTransition] = useTransition();
  const [moveError, setMoveError] = useState<string | null>(null);
  const updated = formatEntryDate(entry.updatedAt);
  const moveTargets = selectableKnowledgeFolders(folders);

  const moveToFolder = (folderId: string) => {
    setMoveError(null);
    startMoveTransition(async () => {
      const result = await moveKnowledgeEntry(entry.id, folderId);
      if (!result.ok) {
        setMoveError(result.message);
        return;
      }
      onMoved?.();
    });
  };

  return (
    <div className="flex items-stretch gap-1 px-1 py-1 sm:px-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start justify-between gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-[#f7faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11181d] focus-visible:ring-offset-2"
      >
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#0b1220]">{entry.title}</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-500">
            {entryPreviewBody(entry)}
          </p>
          {folderLabel ? (
            <p className="mt-1 text-[11px] font-medium text-[#6b7c75]">{folderLabel}</p>
          ) : null}
          {moveError ? (
            <p className="mt-1 text-[11px] text-red-700">{moveError}</p>
          ) : null}
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
            disabled={movePending}
          >
            {movePending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <MoreHorizontal className="size-4" aria-hidden />
            )}
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
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Move to…</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-48">
                {moveTargets.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    onClick={() => moveToFolder(target.id)}
                  >
                    {target.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={onUnlearn}>Unlearn</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function KnowledgeFolderPicker({
  folders,
  value,
  onChange,
  id,
  label = "Save to folder",
}: {
  folders: KnowledgeFolder[];
  value: string;
  onChange: (folderId: string) => void;
  id?: string;
  label?: string;
}) {
  const options = selectableKnowledgeFolders(folders);
  return (
    <label className="block space-y-1.5" htmlFor={id}>
      <span className="text-[12px] font-medium text-[#35443f]">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(DASHBOARD_INPUT_CLASS, "h-10 w-full bg-white px-3 text-[13px]")}
      >
        {options.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function resolveFolderSummariesWithUnsorted(input: {
  folders: KnowledgeFolder[];
  folderSummaries: KnowledgeFolderSummary[];
  entries: CaraKnowledgeEntry[];
  assignments: Map<string, string>;
}): KnowledgeFolderSummary[] {
  const grouped = new Map<string, number>();
  const latest = new Map<string, string | null>();

  for (const entry of input.entries) {
    const folderId = resolveEntryFolderId(entry, input.folders, input.assignments);
    grouped.set(folderId, (grouped.get(folderId) ?? 0) + 1);
    const current = latest.get(folderId);
    if (!entry.updatedAt) continue;
    if (!current || new Date(entry.updatedAt).getTime() > new Date(current).getTime()) {
      latest.set(folderId, entry.updatedAt);
    }
  }

  const summaries = input.folderSummaries.map((folder) => ({
    ...folder,
    entryCount: grouped.get(folder.id) ?? 0,
    lastUpdatedAt: latest.get(folder.id) ?? null,
  }));

  const unsorted = unsortedKnowledgeFolder();
  const unsortedCount = grouped.get(UNSORTED_KNOWLEDGE_FOLDER_ID) ?? 0;
  if (unsortedCount > 0) {
    summaries.push({
      ...unsorted,
      entryCount: unsortedCount,
      lastUpdatedAt: latest.get(UNSORTED_KNOWLEDGE_FOLDER_ID) ?? null,
    });
  }

  return summaries;
}

export function folderLabelForEntry(
  entry: CaraKnowledgeEntry,
  folders: KnowledgeFolder[],
  assignments: Map<string, string>,
): string {
  return folderLabelById(
    folders,
    resolveEntryFolderId(entry, folders, assignments),
  );
}

export function entriesForFolder(
  folderId: string,
  entries: CaraKnowledgeEntry[],
  folders: KnowledgeFolder[],
  assignments: Map<string, string>,
): CaraKnowledgeEntry[] {
  return entries.filter(
    (entry) => resolveEntryFolderId(entry, folders, assignments) === folderId,
  );
}

export function openFolderOrNull(
  folderId: string | null | undefined,
  folders: KnowledgeFolder[],
): KnowledgeFolder | null {
  if (!folderId) return null;
  return folderById(folders, folderId);
}
