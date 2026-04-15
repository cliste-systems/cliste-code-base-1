"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CallHistoryRow } from "@/lib/call-history-types";
import { OUTCOME_LABELS } from "@/lib/call-history-types";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";

const PAGE_SIZE = 3;

function OutcomePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-gray-200/60 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
      {label}
    </span>
  );
}

type CallHistoryTableProps = {
  calls: CallHistoryRow[];
  /** Deep-link from bookings etc. (`?call=<call_logs.id>`) — opens transcript dialog. */
  initialOpenCallId?: string | null;
};

export function CallHistoryTable({
  calls,
  initialOpenCallId,
}: CallHistoryTableProps) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<CallHistoryRow | null>(null);
  const openedFromQueryRef = useRef(false);

  const totalPages = Math.max(1, Math.ceil(calls.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const pageRows = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return calls.slice(start, start + PAGE_SIZE);
  }, [calls, safePage]);

  const openTranscript = useCallback((row: CallHistoryRow) => {
    setActive(row);
    setOpen(true);
  }, []);

  useEffect(() => {
    const raw = initialOpenCallId?.trim();
    if (!raw || openedFromQueryRef.current) return;
    const row = calls.find((c) => c.id === raw);
    if (!row) return;
    openedFromQueryRef.current = true;
    const idx = calls.findIndex((c) => c.id === raw);
    if (idx >= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(Math.floor(idx / PAGE_SIZE));
    }
    openTranscript(row);
  }, [calls, initialOpenCallId, openTranscript]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setActive(null);
  }, []);

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(0, p - 1));
  }, []);

  const goNext = useCallback(() => {
    setPage((p) => Math.min(totalPages - 1, p + 1));
  }, [totalPages]);

  const rangeStart = calls.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd =
    calls.length === 0 ? 0 : safePage * PAGE_SIZE + pageRows.length;

  const canPrev = safePage > 0;
  const canNext = safePage < totalPages - 1;

  return (
    <div>
      <div className="hidden w-full overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] sm:block">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200/80 bg-white">
                <th className="w-[25%] px-6 py-4 text-sm font-medium text-gray-500">
                  Date &amp; time
                </th>
                <th className="w-[30%] px-6 py-4 text-sm font-medium text-gray-500">
                  Caller ID
                </th>
                <th className="w-[15%] px-6 py-4 text-sm font-medium text-gray-500">
                  Duration
                </th>
                <th className="w-[20%] px-6 py-4 text-sm font-medium text-gray-500">
                  Outcome
                </th>
                <th className="w-[10%] px-6 py-4 text-right text-sm font-medium text-gray-500">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No calls to display.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={active?.id === row.id ? "selected" : undefined}
                    tabIndex={0}
                    className="group cursor-pointer border-b border-gray-100 transition-colors last:border-none hover:bg-gray-50/60"
                    onClick={() => openTranscript(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openTranscript(row);
                      }
                    }}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {row.dateTimeLabel}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {row.callerDisplay}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 tabular-nums">
                      {row.durationLabel}
                    </td>
                    <td className="px-6 py-4">
                      <OutcomePill label={OUTCOME_LABELS[row.outcome]} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        className="inline-flex text-gray-400 transition-colors group-hover:text-gray-700"
                        aria-label={`Open transcript for ${row.callerDisplay}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openTranscript(row);
                        }}
                      >
                        <FileText className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 sm:hidden">
        {pageRows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            No calls to display.
          </div>
        ) : (
          pageRows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={cn(
                "w-full rounded-2xl border border-gray-200/80 bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors",
                "hover:bg-gray-50/60 focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:outline-none",
                active?.id === row.id && "ring-1 ring-gray-200/80",
              )}
              onClick={() => openTranscript(row)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <OutcomePill label={OUTCOME_LABELS[row.outcome]} />
                    <span className="text-xs tabular-nums text-gray-500">
                      {row.durationLabel}
                    </span>
                  </div>
                  <p className="text-sm font-medium tracking-tight text-gray-900">
                    {row.callerDisplay}
                  </p>
                  <p className="text-xs tabular-nums text-gray-500">
                    {row.dateTimeLabel}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-gray-400">
                  Transcript
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col justify-between gap-4 px-2 sm:flex-row sm:items-center">
        <p className="text-sm text-gray-500">
          Showing{" "}
          <span className="font-semibold text-gray-900">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-gray-900">{calls.length}</span>{" "}
          calls
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              canPrev
                ? "cursor-pointer text-gray-900 hover:text-gray-700"
                : "cursor-not-allowed text-gray-400 opacity-60",
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Previous
          </button>
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              totalPages <= 1 ? "text-gray-400" : "text-gray-700",
            )}
          >
            Page {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              canNext
                ? "cursor-pointer text-gray-900 hover:text-gray-700"
                : "cursor-not-allowed text-gray-400 opacity-60",
            )}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton
          className={cn(
            "flex w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden border-gray-200/80 bg-white p-0 sm:max-h-[min(88vh,780px)] sm:max-w-4xl",
            "max-sm:top-0 max-sm:right-0 max-sm:bottom-0 max-sm:left-auto max-sm:h-full max-sm:max-h-[100dvh] max-sm:w-[min(100%,24rem)] max-sm:max-w-[min(100vw,24rem)] max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:rounded-l-xl max-sm:border-l max-sm:shadow-xl",
            "sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
            "max-sm:data-open:animate-in max-sm:data-open:slide-in-from-right max-sm:data-open:duration-200 max-sm:data-closed:animate-out max-sm:data-closed:slide-out-to-right",
          )}
        >
          {active ? (
            <>
              <DialogHeader className="shrink-0 space-y-1 border-b border-gray-200/80 px-6 py-4">
                <DialogTitle className="text-lg text-gray-900">
                  Call details
                </DialogTitle>
                <DialogDescription className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600">
                  <span className="font-mono font-medium text-gray-900">
                    {active.callerDisplay}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span>{active.dateTimeLabel}</span>
                  <span className="text-gray-400">·</span>
                  <span className="tabular-nums">{active.durationLabel}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-gray-200/80">
                <div className="flex min-h-0 flex-col overflow-hidden">
                  <div className="shrink-0 border-b border-gray-100 px-6 py-2 lg:border-b-0">
                    <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      Verbatim
                    </p>
                    <p className="text-xs text-gray-400">
                      As captured from speech recognition
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <pre className="rounded-lg border border-gray-200/80 bg-gray-50/80 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-900 sm:text-sm">
                      {active.transcriptVerbatim}
                    </pre>
                  </div>
                </div>
                <div className="flex min-h-0 flex-col overflow-hidden border-t border-gray-200/80 lg:border-t-0">
                  <div className="shrink-0 space-y-1 border-b border-gray-100 px-6 py-3">
                    <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      AI summary
                    </p>
                    <p className="text-sm leading-relaxed text-gray-800">
                      {active.aiSummary ??
                        "No summary for this call (older log or empty transcript)."}
                    </p>
                  </div>
                  <div className="shrink-0 px-6 pt-3 pb-1">
                    <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      Salon-friendly transcript
                    </p>
                    <p className="text-xs text-gray-400">
                      Menu-aware wording for review (e.g. haircut names)
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                    <pre className="rounded-lg border border-gray-200/80 bg-white p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-900 sm:text-sm">
                      {active.transcriptReview ?? active.transcriptVerbatim}
                    </pre>
                    {!active.transcriptReview &&
                      active.transcriptVerbatim !== "No transcript on file." && (
                        <p className="mt-2 text-xs text-gray-400">
                          Same as verbatim — new calls include automated menu fixes and a
                          separate summary.
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
