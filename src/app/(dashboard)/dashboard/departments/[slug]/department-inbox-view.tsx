"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, CheckCircle2, Copy, Inbox, MessageSquare, Search } from "lucide-react";

import { CallDetailsDialogButton } from "@/components/dashboard/call-details-dialog";

import { EmptyState } from "@/components/dashboard/empty-state";
import { CallerTextBackDialog } from "@/components/dashboard/caller-text-back-dialog";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_SELECT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  DetailActionButton,
  DetailPanelShell,
  ListDetailLayout,
} from "@/components/dashboard/list-detail";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ANONYMOUS_CALLER_E164,
  normalizeBlockedCallerE164,
} from "@/lib/blocked-callers";

import { blockCallerAndDismissTicket } from "../../settings/blocked-numbers-actions";
import { markTicketReopen, markTicketResolved } from "../../action-inbox/actions";
import {
  copyDetailsText,
  departmentListPreview,
  displayActionTicketSummary,
  hasKnownCallerName,
  inboxCallerMetaLine,
  isUnderReviewTicket,
  actionTicketUnderReviewCopy,
  matchesActionSearch,
  type ActionInboxItem,
  type ActionInboxMetrics,
} from "../../action-inbox/action-inbox-helpers";
import {
  parseDepartmentRequestSummary,
} from "@/lib/department-request-summary";
import { DepartmentRequestSummaryCard } from "@/components/dashboard/department-request-summary-card";

type StatusTab = "open" | "resolved";

type DepartmentInboxViewProps = {
  items: ActionInboxItem[];
  metrics: ActionInboxMetrics;
  initialSelectedTicketId?: string | null;
  blockedCallerE164s: string[];
  className?: string;
};

export function DepartmentInboxView({
  items,
  metrics: _metrics,
  initialSelectedTicketId = null,
  blockedCallerE164s,
  className,
}: DepartmentInboxViewProps) {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<StatusTab>(() => {
    if (
      initialSelectedTicketId &&
      items.some(
        (i) => i.id === initialSelectedTicketId && i.status === "open",
      )
    ) {
      return "open";
    }
    return items.some((i) => i.status === "open") ? "open" : "resolved";
  });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedTicketId,
  );
  const [copied, setCopied] = useState(false);

  const openCount = items.filter((i) => i.status === "open").length;
  const resolvedCount = items.filter((i) => i.status === "resolved").length;

  const tabItems = useMemo(
    () => items.filter((i) => i.status === statusTab),
    [items, statusTab],
  );

  const filtered = useMemo(() => {
    return tabItems.filter((i) => matchesActionSearch(i, search));
  }, [tabItems, search]);

  const resolvedSelectedId = useMemo(() => {
    if (selectedId && filtered.some((i) => i.id === selectedId)) return selectedId;
    return filtered[0]?.id ?? null;
  }, [selectedId, filtered]);

  const selected = useMemo(
    () => filtered.find((i) => i.id === resolvedSelectedId) ?? null,
    [filtered, resolvedSelectedId],
  );

  const copyDetails = useCallback(async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(copyDetailsText(selected));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [selected]);

  const isOpenQueue = statusTab === "open";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-hidden", className)}>
      <div
        className="inline-flex w-full max-w-sm shrink-0 rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-0.5"
        role="tablist"
        aria-label="Request status"
      >
        {(
          [
            { id: "open" as const, label: "To do", count: openCount },
            { id: "resolved" as const, label: "Done", count: resolvedCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={statusTab === tab.id}
            onClick={() => setStatusTab(tab.id)}
            className={cn(
              "min-w-0 flex-1 rounded-md px-4 py-2.5 text-[14px] font-semibold transition-colors",
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
        <ListDetailLayout
          className="min-h-0 flex-1 gap-0 max-xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]"
          list={
            <div
              className={cn(
                "flex h-full min-h-0 flex-col overflow-hidden max-xl:border-b max-xl:border-[#dfe7e2] xl:border-r",
                "border-[#dfe7e2] bg-[#fbfcfb] xl:border-r-[#dfe7e2]",
              )}
            >
              <div className="shrink-0 border-b border-inherit px-4 py-3 sm:px-5">
                <p className="text-[14px] font-semibold text-[#11181d]">
                  {isOpenQueue ? "Requests" : "Completed"}
                </p>
                <div className="relative mt-2">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or phone"
                    aria-label="Search requests"
                    className="h-10 w-full border-[#b9c8c1] bg-white py-1 pl-8 text-[14px] placeholder:text-slate-400"
                  />
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
                    title={statusTab === "open" ? "All clear" : "Nothing done yet"}
                    description={
                      statusTab === "open"
                        ? "New customer requests from Cara will show up here."
                        : "Completed requests appear here."
                    }
                    className="w-full py-10"
                  />
                ) : (
                  <ul className="space-y-2" role="listbox" aria-label="Department requests">
                    {filtered.map((row) => (
                      <DepartmentListRow
                        key={row.id}
                        row={row}
                        selected={row.id === resolvedSelectedId}
                        onSelect={() => setSelectedId(row.id)}
                        tinted={isOpenQueue}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          }
          detail={
            <DepartmentDetailPanel
              item={selected}
              copied={copied}
              onCopyDetails={copyDetails}
              blockedCallerE164s={blockedCallerE164s}
              onRefresh={() => router.refresh()}
            />
          }
        />
      </section>
    </div>
  );
}

function callerLine(row: ActionInboxItem): string {
  const name = hasKnownCallerName(row) ? row.callerName : "Unknown caller";
  const phone = row.callerDisplay.trim() || "No phone";
  return `${name} ${phone}`;
}

function DepartmentListRow({
  row,
  selected,
  onSelect,
  tinted,
}: {
  row: ActionInboxItem;
  selected: boolean;
  onSelect: () => void;
  tinted: boolean;
}) {
  const preview = departmentListPreview(row);

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "w-full rounded-lg border px-3 py-3 text-left transition-colors",
          tinted
            ? "border-[#cfd9d4] bg-white hover:border-[#9da9a4]"
            : "border-[#dfe7e2] bg-white/90 hover:border-[#9da9a4]",
          selected &&
            "border-[#353D42] bg-white shadow-[inset_4px_0_0_#353D42]",
        )}
      >
        <p className="text-[14px] font-semibold leading-snug text-[#0b1220]">
          {callerLine(row)}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-slate-600">
          {preview}
        </p>
        <p className="mt-1.5 text-[12px] text-slate-500 tabular-nums">{row.createdAtLabel}</p>
      </button>
    </li>
  );
}

function DepartmentDetailPanel({
  item,
  copied,
  onCopyDetails,
  blockedCallerE164s,
  onRefresh,
}: {
  item: ActionInboxItem | null;
  copied: boolean;
  onCopyDetails: () => void;
  blockedCallerE164s: string[];
  onRefresh: () => void;
}) {
  if (!item) {
    return (
      <DetailPanelShell surface="embedded">
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <EmptyState
            icon={Inbox}
            title="Pick a request"
            description="Select one from the list to see who to call and what they need."
            className="w-full py-10"
          />
        </div>
      </DetailPanelShell>
    );
  }

  return (
    <DepartmentDetailContent
      key={item.id}
      item={item}
      copied={copied}
      onCopyDetails={onCopyDetails}
      blockedCallerE164s={blockedCallerE164s}
      onRefresh={onRefresh}
    />
  );
}

function DepartmentDetailContent({
  item,
  copied,
  onCopyDetails,
  blockedCallerE164s,
  onRefresh,
}: {
  item: ActionInboxItem;
  copied: boolean;
  onCopyDetails: () => void;
  blockedCallerE164s: string[];
  onRefresh: () => void;
}) {
  const hasPhone = item.callerNumber.trim().length > 0;
  const tel = hasPhone ? `tel:${item.callerNumber.replace(/[^\d+]/g, "")}` : null;
  const isOpen = item.status === "open";
  const summaryText = displayActionTicketSummary(item.summary, undefined, {
    underReview: isUnderReviewTicket(item),
  });
  const requestSummary = parseDepartmentRequestSummary(item.summary);
  const callerE164 = normalizeBlockedCallerE164(item.callerNumber);
  const canBlockAndDismiss =
    isOpen &&
    callerE164 != null &&
    item.callerNumber.trim() !== ANONYMOUS_CALLER_E164 &&
    !blockedCallerE164s.includes(callerE164);
  const [blockDismissOpen, setBlockDismissOpen] = useState(false);
  const [textBackOpen, setTextBackOpen] = useState(false);
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onBlockAndDismiss() {
    if (!callerE164) return;
    setBlockMsg(null);
    startTransition(async () => {
      const result = await blockCallerAndDismissTicket({
        ticketId: item.id,
        phone: callerE164,
      });
      setBlockDismissOpen(false);
      if (!result.ok) {
        setBlockMsg(result.message);
        return;
      }
      onRefresh();
    });
  }

  return (
    <DetailPanelShell surface="embedded">
      <div className="shrink-0 border-b border-[#dfe7e2] bg-white px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill variant={isOpen ? "brand" : "success"} dot>
            {isOpen ? "To do" : "Done"}
          </StatusPill>
          {isUnderReviewTicket(item) ? (
            <StatusPill variant="attention">Under review</StatusPill>
          ) : null}
          <span className="text-[12px] text-slate-500 tabular-nums">{item.createdAtLabel}</span>
        </div>

        {isUnderReviewTicket(item) ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-950">
            {actionTicketUnderReviewCopy()}
          </p>
        ) : null}

        {requestSummary ? (
          <DepartmentRequestSummaryCard
            summary={requestSummary}
            callerName={item.callerName}
            callerDisplay={item.callerDisplay}
            callerTel={tel}
            showCallerName={hasKnownCallerName(item)}
          />
        ) : (
          <>
            <p className="mt-4 text-[20px] font-semibold leading-snug tracking-tight text-[#0b1220] sm:text-[22px]">
              {summaryText}
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[16px] font-semibold text-[#0b1220]">
                {hasKnownCallerName(item) ? item.callerName : "Unknown caller"}
              </span>
              {hasPhone ? (
                <a
                  href={tel!}
                  className="text-[18px] font-semibold tabular-nums text-[#353D42] underline-offset-2 hover:underline"
                >
                  {item.callerDisplay}
                </a>
              ) : (
                <span className="text-[15px] text-slate-500">No phone left</span>
              )}
            </div>
          </>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <CallDetailsDialogButton
            ticketId={item.id}
            callLogId={item.callLogId}
            callerName={item.callerName}
            callerDisplay={item.callerDisplay}
          />
          {isOpen ? (
            <form action={markTicketResolved}>
              <input type="hidden" name="ticketId" value={item.id} />
              <DetailActionButton type="submit" className="min-h-11 px-5 text-[14px] font-semibold">
                Mark done
              </DetailActionButton>
            </form>
          ) : (
            <form action={markTicketReopen}>
              <input type="hidden" name="ticketId" value={item.id} />
              <DetailActionButton type="submit" className="min-h-11 px-5 text-[14px] font-semibold">
                Reopen
              </DetailActionButton>
            </form>
          )}
          {hasPhone ? (
            <DetailActionButton
              type="button"
              onClick={() => setTextBackOpen(true)}
              className="min-h-11 px-4"
            >
              <MessageSquare className="size-4" aria-hidden />
              Text back
            </DetailActionButton>
          ) : null}
          <DetailActionButton type="button" onClick={onCopyDetails} className="min-h-11 px-4">
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </DetailActionButton>
          {canBlockAndDismiss ? (
            <DetailActionButton
              type="button"
              onClick={() => setBlockDismissOpen(true)}
              disabled={pending}
              className="min-h-11 px-4"
            >
              <Ban className="size-4" aria-hidden />
              Block
            </DetailActionButton>
          ) : null}
        </div>
        {blockMsg ? <p className="mt-2 text-[13px] text-red-600">{blockMsg}</p> : null}
      </div>

      <ConfirmDialog
        open={blockDismissOpen}
        onOpenChange={setBlockDismissOpen}
        title="Block caller and dismiss?"
        description="This number will be blocked from future calls and this request will be marked done."
        confirmLabel="Block + dismiss"
        onConfirm={onBlockAndDismiss}
        pending={pending}
        destructive
      />
      {hasPhone ? (
        <CallerTextBackDialog
          open={textBackOpen}
          onOpenChange={setTextBackOpen}
          ticketId={item.id}
          callerName={item.callerName}
          callerDisplay={item.callerDisplay}
          callerNumber={item.callerNumber}
        />
      ) : null}
    </DetailPanelShell>
  );
}
