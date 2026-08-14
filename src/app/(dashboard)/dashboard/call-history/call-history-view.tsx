"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Ban, Check, Copy, Phone, PhoneCall, Search, ShieldOff } from "lucide-react";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DetailActionButton,
  DetailPanelBody,
  DetailPanelFooter,
  DetailPanelHeader,
  DetailPanelShell,
  DetailSection,
  ListDetailLayout,
} from "@/components/dashboard/list-detail";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_ICON_CHIP_ROW,
  DASHBOARD_ICON_GLYPH_LG,
  DASHBOARD_SELECT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import type { DashboardMetricRangeKey } from "@/lib/dashboard-metric-range";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ANONYMOUS_CALLER_E164,
  normalizeBlockedCallerE164,
} from "@/lib/blocked-callers";

import {
  addBlockedCaller,
  removeBlockedCallerByPhone,
} from "../settings/blocked-numbers-actions";
import { fetchCallHistoryDetail } from "./actions";
import { useDashboardVertical } from "../dashboard-vertical-context";
import {
  OUTCOME_FILTER_OPTIONS,
  callDisplayName,
  cleanedTranscriptForDisplay,
  matchesOutcomeFilter,
  matchesSearch,
  outcomeBadgeVariant,
  primaryTranscriptForDisplay,
  callSummaryForDisplay,
  type CallHistoryListItem,
  type CallHistoryMetrics,
  type OutcomeFilterValue,
} from "./call-history-helpers";

export type CallHistoryPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rangeKey: DashboardMetricRangeKey;
};

type CallHistoryViewProps = {
  calls: CallHistoryListItem[];
  metrics: CallHistoryMetrics;
  initialSelectedCallId?: string | null;
  pagination?: CallHistoryPagination;
  blockedCallerE164s: string[];
  businessName?: string;
  className?: string;
};

function callsPageHref(
  pagination: CallHistoryPagination,
  page: number,
  callId?: string | null,
): string {
  const params = new URLSearchParams();
  if (pagination.rangeKey !== "today") {
    params.set("range", pagination.rangeKey);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  if (callId?.trim()) {
    params.set("call", callId.trim());
  }
  const qs = params.toString();
  return qs ? `${DASHBOARD_ROUTES.calls}?${qs}` : DASHBOARD_ROUTES.calls;
}

export function CallHistoryView({
  calls,
  metrics: _metrics,
  initialSelectedCallId,
  pagination,
  blockedCallerE164s,
  businessName = "",
  className,
}: CallHistoryViewProps) {
  const router = useRouter();
  const { copy } = useDashboardVertical();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilterValue>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [detailById, setDetailById] = useState<
    Record<string, { transcriptVerbatim: string; transcriptReview: string | null }>
  >({});
  const blockedSet = useMemo(
    () => new Set(blockedCallerE164s),
    [blockedCallerE164s],
  );

  const filtered = useMemo(() => {
    return calls.filter(
      (c) => matchesSearch(c, search) && matchesOutcomeFilter(c, outcomeFilter),
    );
  }, [calls, search, outcomeFilter]);

  const resolvedSelectedId = useMemo(() => {
    if (selectedId && filtered.some((c) => c.id === selectedId)) {
      return selectedId;
    }
    const deep = initialSelectedCallId?.trim();
    if (deep && filtered.some((c) => c.id === deep)) return deep;
    return filtered[0]?.id ?? null;
  }, [selectedId, filtered, initialSelectedCallId]);

  const selectedBase = useMemo(
    () => filtered.find((c) => c.id === resolvedSelectedId) ?? null,
    [filtered, resolvedSelectedId],
  );

  const selected = useMemo(() => {
    if (!selectedBase) return null;
    const detail = detailById[selectedBase.id];
    if (!detail) return selectedBase;
    return {
      ...selectedBase,
      transcriptVerbatim: detail.transcriptVerbatim,
      transcriptReview: detail.transcriptReview,
    };
  }, [selectedBase, detailById]);

  const ensureDetailLoaded = useCallback((id: string) => {
    void fetchCallHistoryDetail(id).then((detail) => {
      if (!detail) return;
      setDetailById((prev) => {
        if (prev[id]) return prev;
        return { ...prev, [id]: detail };
      });
    });
  }, []);

  useEffect(() => {
    if (resolvedSelectedId) {
      ensureDetailLoaded(resolvedSelectedId);
    }
  }, [resolvedSelectedId, ensureDetailLoaded]);

  const detailLoading = Boolean(
    selectedBase && !detailById[selectedBase.id],
  );

  const copySummary = useCallback(async () => {
    if (!selected) return;
    const text = callSummaryForDisplay(selected, {
      businessName,
      callerIsBlocked:
        normalizeBlockedCallerE164(selected.callerId) != null &&
        blockedSet.has(normalizeBlockedCallerE164(selected.callerId)!),
    });
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [selected, businessName, blockedSet]);

  return (
    <section
      className={cn(
        DASHBOARD_CARD_SURFACE,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      <ListDetailLayout
        className="min-h-0 flex-1 gap-0 max-xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.15fr)_420px]"
        list={
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#fbfcfb] max-xl:border-b max-xl:border-[#dfe7e2] xl:border-r xl:border-[#dfe7e2]">
            <div className="flex shrink-0 flex-col gap-2 border-b border-[#dfe7e2] bg-[#fbfcfb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <h2 className="text-[15px] font-semibold tracking-tight text-[#11181d]">
                Calls
              </h2>
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
                    placeholder="Search calls"
                    aria-label="Search calls"
                    className="h-9 w-full border-[#b9c8c1] bg-white py-1 pl-8 text-[13px] placeholder:text-slate-400"
                  />
                </div>
                <select
                  value={outcomeFilter}
                  onChange={(e) =>
                    setOutcomeFilter(e.target.value as OutcomeFilterValue)
                  }
                  aria-label="Filter by outcome"
                  className={cn(DASHBOARD_SELECT_CLASS, "h-9 w-full shrink-0 sm:w-[11rem]")}
                >
                  {OUTCOME_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-y-contain",
                filtered.length === 0 &&
                  "flex items-center justify-center",
              )}
            >
              {filtered.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center p-6">
                  <EmptyState
                    icon={Phone}
                    title="No calls yet"
                    description={copy.calls.emptyDescription}
                    className="w-full max-w-xl px-4 py-10"
                  />
                </div>
              ) : (
                <ul className="space-y-2 p-2 sm:p-3" role="listbox" aria-label="Calls">
                  {filtered.map((row) => (
                    <CallListRow
                      key={row.id}
                      row={row}
                      selected={row.id === resolvedSelectedId}
                      onSelect={() => {
                        setSelectedId(row.id);
                        ensureDetailLoaded(row.id);
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
            {pagination && pagination.totalPages > 1 ? (
              <CallHistoryPaginationBar
                pagination={pagination}
                selectedCallId={resolvedSelectedId}
                rangeFromUrl={searchParams.get("range")}
              />
            ) : null}
          </div>
        }
        detail={
          <CallDetailPanel
            call={selected}
            copied={copied}
            detailLoading={detailLoading}
            onCopySummary={copySummary}
            blockedSet={blockedSet}
            businessName={businessName}
            onRefresh={() => router.refresh()}
          />
        }
      />
    </section>
  );
}

function CallListRow({
  row,
  selected,
  onSelect,
}: {
  row: CallHistoryListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = callDisplayName(row);
  const preview = row.summaryPreview;

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "flex min-h-[82px] w-full cursor-pointer gap-3 rounded-lg border px-3 py-3 text-left shadow-[0_1px_0_rgba(17,24,29,0.04)] transition-colors sm:gap-4 sm:px-4",
          selected
            ? "border-[#353D42] bg-white shadow-[inset_3px_0_0_#353D42,0_1px_0_rgba(17,24,29,0.04)]"
            : "border-[#dfe7e2] bg-white/78 hover:border-[#9da9a4] hover:bg-white",
        )}
      >
        <span className={DASHBOARD_ICON_CHIP_ROW}>
          <Phone className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-[#11181d]">
            {name}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-slate-500">
            {row.callerDisplay || "Unknown number"}
            <span className="text-slate-300"> · </span>
            {row.dateTimeLabel}
          </span>
          <span className="mt-2 block text-[12px] font-medium text-slate-600">
            {row.intentLabel}
          </span>
          {preview ? (
            <span className="mt-0.5 line-clamp-1 text-[12px] text-slate-500">
              {preview}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5 text-right">
          <StatusPill variant={outcomeBadgeVariant(row.outcome)} dot>
            {row.outcomeLabel}
          </StatusPill>
          <span className="text-[12px] tabular-nums text-slate-500">
            {row.durationLabel}
          </span>
          {row.hasOpenAction ? (
            <StatusPill variant="attention">Needs attention</StatusPill>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function CallHistoryPaginationBar({
  pagination,
  selectedCallId,
  rangeFromUrl,
}: {
  pagination: CallHistoryPagination;
  selectedCallId: string | null;
  rangeFromUrl: string | null;
}) {
  const rangeKey =
    rangeFromUrl === "7d" || rangeFromUrl === "4w"
      ? rangeFromUrl
      : pagination.rangeKey;
  const paged: CallHistoryPagination = { ...pagination, rangeKey };
  const { page, totalPages, totalCount, pageSize } = paged;
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#dfe7e2] bg-[#fbfcfb] px-4 py-2.5 sm:px-5">
      <p className="text-[12px] text-slate-500 tabular-nums">
        {from}–{to} of {totalCount}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={callsPageHref(paged, page - 1, selectedCallId)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-100 px-2.5 py-1 text-[12px] text-slate-300">
            Previous
          </span>
        )}
        <span className="text-[12px] text-slate-500 tabular-nums">
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={callsPageHref(paged, page + 1, selectedCallId)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-100 px-2.5 py-1 text-[12px] text-slate-300">
            Next
          </span>
        )}
      </div>
    </div>
  );
}

function CallDetailPanel({
  call,
  copied,
  detailLoading,
  onCopySummary,
  blockedSet,
  businessName,
  onRefresh,
}: {
  call: CallHistoryListItem | null;
  copied: boolean;
  detailLoading: boolean;
  onCopySummary: () => void;
  blockedSet: Set<string>;
  businessName: string;
  onRefresh: () => void;
}) {
  if (!call) {
    return (
      <DetailPanelShell surface="embedded">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={PhoneCall}
            title="Select a call"
            description="Choose a call to review the summary and transcript."
            className="mx-6 w-full max-w-sm px-4 py-9"
          />
        </div>
      </DetailPanelShell>
    );
  }

  return (
    <CallDetailPanelContent
      key={call.id}
      call={call}
      copied={copied}
      detailLoading={detailLoading}
      onCopySummary={onCopySummary}
      blockedSet={blockedSet}
      businessName={businessName}
      onRefresh={onRefresh}
    />
  );
}

function CallDetailPanelContent({
  call,
  copied,
  detailLoading,
  onCopySummary,
  blockedSet,
  businessName,
  onRefresh,
}: {
  call: CallHistoryListItem;
  copied: boolean;
  detailLoading: boolean;
  onCopySummary: () => void;
  blockedSet: Set<string>;
  businessName: string;
  onRefresh: () => void;
}) {
  const [showCleanedTranscript, setShowCleanedTranscript] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [unblockConfirmOpen, setUnblockConfirmOpen] = useState(false);
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const callerE164 = normalizeBlockedCallerE164(call.callerId);
  const canManageBlock =
    callerE164 != null && call.callerId.trim() !== ANONYMOUS_CALLER_E164;
  const isBlocked = callerE164 != null && blockedSet.has(callerE164);

  const summary = callSummaryForDisplay(call, {
    businessName,
    callerIsBlocked: isBlocked,
  });
  const safeTranscript = primaryTranscriptForDisplay(call);
  const cleanedTranscript = cleanedTranscriptForDisplay(call);
  const showCleaned =
    showCleanedTranscript && cleanedTranscript != null && cleanedTranscript !== safeTranscript;
  const hasCleanedToggle =
    cleanedTranscript != null &&
    safeTranscript != null &&
    cleanedTranscript.trim() !== safeTranscript.trim();
  const name = callDisplayName(call);
  const showOutcomeBadge = call.outcome !== "answered";

  function onConfirmBlock() {
    if (!callerE164) return;
    setBlockMsg(null);
    startTransition(async () => {
      const result = await addBlockedCaller({ phone: callerE164 });
      setBlockConfirmOpen(false);
      if (!result.ok) {
        setBlockMsg(result.message);
        return;
      }
      setBlockMsg("Caller blocked.");
      onRefresh();
    });
  }

  function onConfirmUnblock() {
    if (!callerE164) return;
    setBlockMsg(null);
    startTransition(async () => {
      const result = await removeBlockedCallerByPhone({ phone: callerE164 });
      setUnblockConfirmOpen(false);
      if (!result.ok) {
        setBlockMsg(result.message);
        return;
      }
      setBlockMsg("Caller unblocked.");
      onRefresh();
    });
  }

  return (
    <DetailPanelShell surface="embedded">
      <DetailPanelHeader
        eyebrow="Call details"
        title={name}
        subtitle={call.callerDisplay || "Unknown number"}
        meta={
          <>
            {call.dateTimeLabel}
            <span className="text-slate-300"> · </span>
            <span className="tabular-nums">{call.durationLabel}</span>
          </>
        }
        badges={
          <>
            {showOutcomeBadge ? (
              <StatusPill variant={outcomeBadgeVariant(call.outcome)} dot>
                {call.outcomeLabel}
              </StatusPill>
            ) : null}
            <StatusPill>{call.intentLabel}</StatusPill>
            {call.hasOpenAction ? (
              <StatusPill variant="attention">Needs attention</StatusPill>
            ) : null}
          </>
        }
      />

      <DetailPanelBody>
        <DetailSection title="Summary">
          <p className="text-[14px] leading-relaxed text-slate-700">
            {summary ?? "No summary available."}
          </p>
        </DetailSection>

        {call.followUp ? (
          <DetailSection title="Follow-up">
            <p className="text-[14px] leading-relaxed text-slate-700">
              {call.followUp.summary}
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              {call.followUp.status === "open"
                ? "Cara took this as a message or handoff — it stays on this call."
                : "This follow-up is marked resolved."}
            </p>
          </DetailSection>
        ) : null}

        <DetailSection title="Transcript">
          {detailLoading ? (
            <p className="text-[13px] text-slate-500">Loading transcript…</p>
          ) : !safeTranscript && !showCleaned ? (
            <p className="text-[13px] text-slate-500">No transcript available.</p>
          ) : !transcriptOpen ? (
            <button
              type="button"
              onClick={() => setTranscriptOpen(true)}
              className="text-[13px] font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              Show full transcript
            </button>
          ) : (
            <>
              <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
                Stored for 30 days. Personal details can be erased via{" "}
                <Link
                  href="/dashboard/legal/data-requests"
                  className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
                >
                  Legal → Data requests
                </Link>
                .
              </p>
              <pre className="rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-slate-700 shadow-inner">
                {showCleaned ? cleanedTranscript : safeTranscript}
              </pre>
              <div className="mt-2 flex flex-wrap gap-3">
                {hasCleanedToggle ? (
                  <button
                    type="button"
                    onClick={() => setShowCleanedTranscript((v) => !v)}
                    className="text-[12px] font-medium text-[#0b1220] underline-offset-2 hover:underline"
                  >
                    {showCleaned ? "Show full transcript" : "Show cleaned transcript"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setTranscriptOpen(false)}
                  className="text-[12px] font-medium text-slate-500 underline-offset-2 hover:underline"
                >
                  Hide transcript
                </button>
              </div>
            </>
          )}
        </DetailSection>
      </DetailPanelBody>

      <DetailPanelFooter>
        {canManageBlock ? (
          isBlocked ? (
            <DetailActionButton
              type="button"
              onClick={() => setUnblockConfirmOpen(true)}
              disabled={pending}
            >
              <ShieldOff className="size-3.5" aria-hidden />
              Unblock
            </DetailActionButton>
          ) : (
            <DetailActionButton
              type="button"
              onClick={() => setBlockConfirmOpen(true)}
              disabled={pending}
            >
              <Ban className="size-3.5" aria-hidden />
              Block this caller
            </DetailActionButton>
          )
        ) : null}
        <DetailActionButton onClick={onCopySummary} disabled={!summary}>
          {copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {copied ? "Copied" : "Copy summary"}
        </DetailActionButton>
      </DetailPanelFooter>

      {blockMsg ? (
        <p className="px-5 pb-3 text-[12px] text-slate-600">{blockMsg}</p>
      ) : null}

      <ConfirmDialog
        open={blockConfirmOpen}
        onOpenChange={setBlockConfirmOpen}
        title="Block this caller?"
        description="Future calls from this number will hear a short message and hang up before Cara answers. You can undo this in Settings."
        confirmLabel="Block caller"
        onConfirm={onConfirmBlock}
        pending={pending}
        destructive
      />
      <ConfirmDialog
        open={unblockConfirmOpen}
        onOpenChange={setUnblockConfirmOpen}
        title="Unblock this caller?"
        description="They will be able to reach Cara again on your line."
        confirmLabel="Unblock"
        onConfirm={onConfirmUnblock}
        pending={pending}
        destructive
      />
    </DetailPanelShell>
  );
}
