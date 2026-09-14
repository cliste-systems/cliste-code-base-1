"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Inbox, Search } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_SELECT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Input } from "@/components/ui/input";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { departmentTicketHref } from "../departments/department-helpers";
import { cn } from "@/lib/utils";

import { useDashboardVertical } from "../dashboard-vertical-context";
import {
  actionCategoryFilterOptions,
  categoryStatusVariant,
  type ActionCategory,
  type ActionCategoryFilter,
} from "./categories";
import {
  briefLine,
  hasKnownCallerName,
  inboxCallerMetaLine,
  type ActionInboxItem,
  type ActionInboxMetrics,
  matchesActionSearch,
  matchesCategoryFilter,
} from "./action-inbox-helpers";

type StatusTab = "open" | "resolved";

type ActionInboxViewProps = {
  items: ActionInboxItem[];
  metrics: ActionInboxMetrics;
  initialSelectedTicketId?: string | null;
  blockedCallerE164s: string[];
  className?: string;
};

export function ActionInboxView({
  items,
  metrics: _metrics,
  initialSelectedTicketId: _initialSelectedTicketId = null,
  blockedCallerE164s: _blockedCallerE164s,
  className,
}: ActionInboxViewProps) {
  const router = useRouter();
  const { copy } = useDashboardVertical();
  const categoryFilterOptions = useMemo(
    () => actionCategoryFilterOptions(copy.actionInbox.categoryLabels),
    [copy.actionInbox.categoryLabels],
  );
  const [statusTab, setStatusTab] = useState<StatusTab>(() =>
    items.some((i) => i.status === "open") ? "open" : "resolved",
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ActionCategoryFilter>("all");

  const openCount = items.filter((i) => i.status === "open").length;
  const resolvedCount = items.filter((i) => i.status === "resolved").length;

  const tabItems = useMemo(
    () => items.filter((i) => i.status === statusTab),
    [items, statusTab],
  );

  const filtered = useMemo(() => {
    return tabItems.filter(
      (i) => matchesActionSearch(i, search) && matchesCategoryFilter(i, categoryFilter),
    );
  }, [tabItems, search, categoryFilter]);

  const isOpenQueue = statusTab === "open";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-hidden", className)}>
      <div
        className="inline-flex w-full max-w-md shrink-0 rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-0.5"
        role="tablist"
        aria-label="Inbox status"
      >
        {(
          [
            { id: "open" as const, label: "Open", count: openCount },
            { id: "resolved" as const, label: "Resolved", count: resolvedCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={statusTab === tab.id}
            onClick={() => setStatusTab(tab.id)}
            className={cn(
              "min-w-0 flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors",
              statusTab === tab.id
                ? "bg-[#11181d] text-white shadow-sm"
                : "text-[#5b6b65] hover:bg-white hover:text-[#11181d]",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-1.5 tabular-nums",
                statusTab === tab.id ? "text-white/80" : "text-slate-400",
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <section
        className={cn(
          DASHBOARD_CARD_SURFACE,
          "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#fbfcfb]">
          <div className="flex shrink-0 flex-col gap-2 border-b border-[#dfe7e2] px-4 py-3 sm:px-5">
            <p className="min-w-0 flex-1 text-[13px] font-semibold text-[#11181d]">
              {isOpenQueue ? "Triage queue" : "Resolved follow-ups"}
            </p>
            <p className="text-[12px] leading-snug text-slate-500">
              Tap a row to open the full follow-up in the right department workspace.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full shrink-0 sm:w-44">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search inbox"
                  aria-label="Search inbox"
                  className="h-9 w-full border-[#b9c8c1] bg-white py-1 pl-8 text-[13px] placeholder:text-slate-400"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as ActionCategoryFilter)
                }
                aria-label="Filter by type"
                className={cn(DASHBOARD_SELECT_CLASS, "h-9 w-full shrink-0 sm:w-[10.5rem]")}
              >
                {categoryFilterOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 sm:px-3",
              filtered.length === 0 && "flex items-center justify-center",
            )}
          >
            {filtered.length === 0 ? (
              <EmptyState
                icon={statusTab === "open" ? CheckCircle2 : Inbox}
                title={statusTab === "open" ? "Inbox zero" : "Nothing resolved yet"}
                description={
                  statusTab === "open"
                    ? "When Cara captures something that needs you, it will appear here."
                    : "Completed follow-ups will appear here."
                }
                className="w-full py-10"
              />
            ) : (
              <ul className="space-y-2" role="listbox" aria-label="Inbox items">
                {filtered.map((row) => (
                  <TriageListRow
                    key={row.id}
                    row={row}
                    tinted={isOpenQueue}
                    onOpen={() =>
                      router.push(
                        departmentTicketHref(row.id, row.departmentSlug),
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function inboxPrimaryLabel(row: ActionInboxItem): string {
  if (hasKnownCallerName(row)) return row.callerName;
  return row.callerDisplay || "Unknown caller";
}

function DepartmentBadge({ label }: { label: string }) {
  return (
    <StatusPill variant="neutral" className="h-5 shrink-0 px-1.5 py-0 text-[10px] font-semibold uppercase leading-none tracking-wide">
      {label}
    </StatusPill>
  );
}

function TriageListRow({
  row,
  tinted,
  onOpen,
}: {
  row: ActionInboxItem;
  tinted: boolean;
  onOpen: () => void;
}) {
  const primary = inboxPrimaryLabel(row);
  const preview = briefLine(row);

  return (
    <li>
      <button
        type="button"
        role="option"
        onClick={onOpen}
        className={cn(
          "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 rounded-lg border bg-white/78 px-3 py-2.5 text-left shadow-[0_1px_0_rgba(17,24,29,0.04)] transition-colors",
          tinted
            ? "border-[#cfd9d4] hover:border-[#9da9a4] hover:bg-white"
            : "border-[#dfe7e2] hover:border-[#9da9a4] hover:bg-white",
        )}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <DepartmentBadge label={row.departmentLabel} />
            <StatusPill
              variant={categoryStatusVariant(row.category)}
              className="h-5 shrink-0 px-1.5 py-0 text-[10px] font-semibold uppercase leading-none tracking-wide"
            >
              {row.categoryShort}
            </StatusPill>
            <span className="min-w-0 truncate text-[13px] font-semibold leading-snug text-[#0b1220]">
              {primary}
            </span>
          </span>
          <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-600">
            {preview}
          </span>
          <span className="mt-1 block truncate text-[11px] text-slate-500 tabular-nums">
            {inboxCallerMetaLine(row)}
          </span>
        </span>
        <span className="mt-0.5 shrink-0 text-[11px] font-medium text-[#353D42]">
          Open →
        </span>
      </button>
    </li>
  );
}
