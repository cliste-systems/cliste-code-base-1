"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Inbox, Phone, PhoneCall, Search, User } from "lucide-react";

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
import { StatusPill } from "@/components/dashboard/status-pill";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  OUTCOME_FILTER_OPTIONS,
  callDisplayName,
  matchesOutcomeFilter,
  matchesSearch,
  outcomeBadgeVariant,
  summaryForDisplay,
  transcriptForDisplay,
  whatHappenedNextLabel,
  type CallHistoryListItem,
  type CallHistoryMetrics,
  type OutcomeFilterValue,
} from "./call-history-helpers";

type CallHistoryViewProps = {
  calls: CallHistoryListItem[];
  metrics: CallHistoryMetrics;
  initialSelectedCallId?: string | null;
  className?: string;
};

export function CallHistoryView({
  calls,
  metrics: _metrics,
  initialSelectedCallId,
  className,
}: CallHistoryViewProps) {
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilterValue>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const selected = useMemo(
    () => filtered.find((c) => c.id === resolvedSelectedId) ?? null,
    [filtered, resolvedSelectedId],
  );

  const copySummary = useCallback(async () => {
    if (!selected) return;
    const text = summaryForDisplay(selected);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [selected]);

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
                  description="When Cara answers, calls will appear here with summaries and outcomes."
                  className="w-full py-10"
                />
              ) : (
                <ul className="divide-y divide-slate-100" role="listbox" aria-label="Calls">
                  {filtered.map((row) => (
                    <CallListRow
                      key={row.id}
                      row={row}
                      selected={row.id === resolvedSelectedId}
                      onSelect={() => setSelectedId(row.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        }
        detail={
          <CallDetailPanel
            call={selected}
            copied={copied}
            onCopySummary={copySummary}
            contactHref={contactHref}
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

function CallDetailPanel({
  call,
  copied,
  onCopySummary,
  contactHref,
}: {
  call: CallHistoryListItem | null;
  copied: boolean;
  onCopySummary: () => void;
  contactHref: string;
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

  const summary = summaryForDisplay(call);
  const transcript = transcriptForDisplay(call);
  const name = callDisplayName(call);
  const whatHappenedNext = whatHappenedNextLabel(call.outcome, call.hasOpenAction);
  const showOutcomeBadge = call.outcome !== "answered";
  const showWhatHappenedNext =
    call.hasOpenAction ||
    (call.outcome !== "answered" && whatHappenedNext !== "Handled");

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
          {transcript ? (
            <pre className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-slate-800">
              {transcript}
            </pre>
          ) : (
            <p className="text-[13px] text-slate-500">No transcript available.</p>
          )}
        </DetailSection>
      </DetailPanelBody>

      <DetailPanelFooter>
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
    </DetailPanelShell>
  );
}
