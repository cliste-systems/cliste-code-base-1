"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Ban, Check, Copy, Inbox, Phone, PhoneCall, Search, ShieldOff, User } from "lucide-react";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DetailActionButton,
  DetailInset,
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
import { blockedCallDashboardSummary } from "@/lib/blocked-call-copy";

import {
  addBlockedCaller,
  removeBlockedCallerByPhone,
} from "../settings/blocked-numbers-actions";
import { fetchCallHistoryDetail } from "./actions";
import { useDashboardVertical } from "../dashboard-vertical-context";
import {
  OUTCOME_FILTER_OPTIONS,
  callDisplayName,
  fullTranscriptForDisplay,
  hasFullTranscript,
  matchesOutcomeFilter,
  matchesSearch,
  outcomeBadgeVariant,
  reviewTranscriptForDisplay,
  summaryForDisplay,
  callSummaryForDisplay,
  whatHappenedNextLabel,
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
  const [blockedSet, setBlockedSet] = useState(
    () => new Set(blockedCallerE164s),
  );

  useEffect(() => {
    setBlockedSet(new Set(blockedCallerE164s));
  }, [blockedCallerE164s]);

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

  const contactHref = DASHBOARD_ROUTES.contacts;

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
          <div className="flex h-full min-h-0 flex-col overflow-hidden max-xl:border-b max-xl:border-slate-100 xl:border-r xl:border-slate-100">
            <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
                Calls
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative w-44 shrink-0">
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
                    className="h-9 w-full border-slate-300 bg-white py-1 pl-8 text-[13px] placeholder:text-slate-400"
                  />
                </div>
                <select
                  value={outcomeFilter}
                  onChange={(e) =>
                    setOutcomeFilter(e.target.value as OutcomeFilterValue)
                  }
                  aria-label="Filter by outcome"
                  className={cn(DASHBOARD_SELECT_CLASS, "h-9 w-[11rem] shrink-0")}
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
                <EmptyState
                  icon={Phone}
                  title="No calls yet"
                  description={copy.calls.emptyDescription}
                  className="w-full py-10"
                />
              ) : (
                <ul className="divide-y divide-slate-100" role="listbox" aria-label="Calls">
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
            contactHref={contactHref}
            blockedSet={blockedSet}
            businessName={businessName}
            onBlockedChange={setBlockedSet}
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
          "flex w-full min-h-[76px] cursor-pointer gap-3 border-l-2 px-4 py-4 text-left transition-colors sm:gap-4 sm:px-5",
          selected
            ? "border-l-[#0b1220] bg-slate-50"
            : "border-l-transparent hover:bg-slate-50/80",
        )}
      >
        <span className={DASHBOARD_ICON_CHIP_ROW}>
          <Phone className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-[#0b1220]">
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
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 sm:px-5">
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
  contactHref,
  blockedSet,
  businessName,
  onBlockedChange,
  onRefresh,
}: {
  call: CallHistoryListItem | null;
  copied: boolean;
  detailLoading: boolean;
  onCopySummary: () => void;
  contactHref: string;
  blockedSet: Set<string>;
  businessName: string;
  onBlockedChange: (next: Set<string>) => void;
  onRefresh: () => void;
}) {
  if (!call) {
    return (
      <DetailPanelShell surface="embedded">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={PhoneCall}
            title="Select a call"
            description="Choose a call to review the summary, transcript, outcome, and follow-up."
            className="w-full py-10"
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
      contactHref={contactHref}
      blockedSet={blockedSet}
      businessName={businessName}
      onBlockedChange={onBlockedChange}
      onRefresh={onRefresh}
    />
  );
}

function CallDetailPanelContent({
  call,
  copied,
  detailLoading,
  onCopySummary,
  contactHref,
  blockedSet,
  businessName,
  onBlockedChange,
  onRefresh,
}: {
  call: CallHistoryListItem;
  copied: boolean;
  detailLoading: boolean;
  onCopySummary: () => void;
  contactHref: string;
  blockedSet: Set<string>;
  businessName: string;
  onBlockedChange: (next: Set<string>) => void;
  onRefresh: () => void;
}) {
  const [showFullTranscript, setShowFullTranscript] = useState(false);
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
  const safeTranscript = reviewTranscriptForDisplay(call);
  const fullTranscript = fullTranscriptForDisplay(call);
  const showFull = showFullTranscript && fullTranscript != null;
  const name = callDisplayName(call);
  const whatHappenedNext = whatHappenedNextLabel(call.outcome, call.hasOpenAction);
  const showOutcomeBadge = call.outcome !== "answered";
  const showWhatHappenedNext =
    call.hasOpenAction ||
    (call.outcome !== "answered" && whatHappenedNext !== "Handled");

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
      onBlockedChange(new Set([...blockedSet, callerE164]));
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
      const next = new Set(blockedSet);
      next.delete(callerE164);
      onBlockedChange(next);
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

        {showWhatHappenedNext ? (
          <DetailSection title="What happened next">
            <p className="text-[14px] font-medium text-slate-800">
              {whatHappenedNext}
            </p>
          </DetailSection>
        ) : null}

        <DetailSection title="Related follow-up">
          {call.followUp ? (
            <DetailInset>
              <p className="text-[13px] leading-relaxed text-slate-700">
                {call.followUp.summary}
              </p>
              <p className="mt-2 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                {call.followUp.status === "open" ? "Open" : "Resolved"}
              </p>
              <Link
                href="/dashboard/action-inbox"
                className="mt-3 inline-flex text-[13px] font-medium text-[#0b1220] underline-offset-2 hover:underline"
              >
                Open in Action Inbox
              </Link>
            </DetailInset>
          ) : (
            <p className="text-[13px] text-slate-500">No follow-up needed</p>
          )}
        </DetailSection>

        <DetailSection title="Transcript">
          <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
            Calls are transcribed for up to 30 days. Card numbers and IDs are
            redacted automatically. Callers may mention personal details — use{" "}
            <Link
              href="/dashboard/legal/data-requests"
              className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              Legal → Data requests
            </Link>{" "}
            to erase if asked.
          </p>
          {detailLoading ? (
            <p className="text-[13px] text-slate-500">Loading transcript…</p>
          ) : safeTranscript || showFull ? (
            <pre className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-slate-800">
              {showFull ? fullTranscript : safeTranscript}
            </pre>
          ) : (
            <p className="text-[13px] text-slate-500">No transcript available.</p>
          )}
          {hasFullTranscript(call) ? (
            <button
              type="button"
              onClick={() => setShowFullTranscript((v) => !v)}
              className="mt-2 text-[12px] font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              {showFull
                ? "Hide full transcript"
                : "Show full transcript (30-day retention)"}
            </button>
          ) : null}
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
        <DetailActionButton href={contactHref}>
          <User className="size-3.5" aria-hidden />
          Open contact
        </DetailActionButton>
        {call.followUp ? (
          <DetailActionButton href="/dashboard/action-inbox">
            <Inbox className="size-3.5" aria-hidden />
            View follow-up
          </DetailActionButton>
        ) : null}
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
