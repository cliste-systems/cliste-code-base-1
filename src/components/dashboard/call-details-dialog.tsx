"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ScrollText } from "lucide-react";

import {
  callDisplayName,
  callNeedsPostCallReviewBanner,
  callSummaryForDisplay,
  cleanedTranscriptForDisplay,
  outcomeBadgeVariant,
  primaryTranscriptForDisplay,
} from "@/app/(dashboard)/dashboard/call-history/call-history-helpers";
import {
  fetchCallDetailForTicket,
  type CallDetailDialogPayload,
} from "@/app/(dashboard)/dashboard/call-history/actions";
import { DetailSection } from "@/components/dashboard/list-detail";
import { CallAudioPlayer } from "@/components/dashboard/call-audio-player";
import { StaffTranscriptView } from "@/components/dashboard/staff-transcript-view";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CALL_POST_PROCESSING_BANNER } from "@/lib/post-call-processing-types";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

type CallDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  callLogId?: string | null;
  fallbackCallerName?: string;
  fallbackCallerDisplay?: string;
};

function toHistoryItem(detail: CallDetailDialogPayload) {
  return {
    id: detail.id,
    createdAt: "",
    dateTimeLabel: detail.dateTimeLabel,
    callerId: detail.callerDisplay,
    callerDisplay: detail.callerDisplay,
    callerName: detail.callerName,
    durationSeconds: detail.durationSeconds,
    durationLabel: detail.durationLabel,
    outcome: detail.outcome,
    outcomeLabel: detail.outcomeLabel,
    intentLabel: detail.intentLabel,
    summaryPreview: null,
    transcriptVerbatim: detail.transcriptVerbatim,
    transcriptReview: detail.transcriptReview,
    aiSummary: detail.aiSummary,
    hasOpenAction: false,
    followUp: null,
    postCallStatus: detail.postCallStatus,
    hasRecording: detail.hasRecording,
  };
}

export function CallDetailsDialog({
  open,
  onOpenChange,
  ticketId,
  callLogId,
  fallbackCallerName,
  fallbackCallerDisplay,
}: CallDetailsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CallDetailDialogPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCleanedTranscript, setShowCleanedTranscript] = useState(false);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setError(null);
      setShowCleanedTranscript(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchCallDetailForTicket({ ticketId, callLogId })
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setDetail(null);
          setError("Could not find a call linked to this request.");
          return;
        }
        setDetail(result);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setError("Could not load call details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, ticketId, callLogId]);

  const historyItem = useMemo(
    () => (detail ? toHistoryItem(detail) : null),
    [detail],
  );

  const summary =
    historyItem != null
      ? callSummaryForDisplay(historyItem, { callerIsBlocked: false })
      : null;
  const safeTranscript =
    historyItem != null ? primaryTranscriptForDisplay(historyItem) : null;
  const cleanedTranscript =
    historyItem != null ? cleanedTranscriptForDisplay(historyItem) : null;
  const hasCleanedToggle =
    cleanedTranscript != null &&
    safeTranscript != null &&
    cleanedTranscript.trim() !== safeTranscript.trim();
  const showCleaned =
    showCleanedTranscript &&
    cleanedTranscript != null &&
    cleanedTranscript !== safeTranscript;
  const displayName =
    historyItem != null
      ? callDisplayName(historyItem)
      : fallbackCallerName?.trim() || "Unknown caller";
  const displayPhone =
    historyItem?.callerDisplay?.trim() ||
    fallbackCallerDisplay?.trim() ||
    "Unknown number";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-[#dfe7e2] bg-[#f6faf7] px-5 py-5 pr-12 text-left">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6b7c75] uppercase">
            Call details
          </p>
          <DialogTitle className="mt-2 text-[20px] font-semibold tracking-tight text-[#11181d]">
            {displayName}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[#5b6b65]">
            {displayPhone}
          </DialogDescription>
          {detail ? (
            <p className="text-[12px] text-[#6b7c75]">
              {detail.dateTimeLabel}
              <span className="text-slate-300"> · </span>
              <span className="tabular-nums">{detail.durationLabel}</span>
            </p>
          ) : null}
          {historyItem ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {historyItem.outcome !== "answered" ? (
                <StatusPill variant={outcomeBadgeVariant(historyItem.outcome)} dot>
                  {historyItem.outcomeLabel}
                </StatusPill>
              ) : null}
              <StatusPill>{historyItem.intentLabel}</StatusPill>
              {callNeedsPostCallReviewBanner(historyItem) ? (
                <StatusPill variant="attention">Processing issue</StatusPill>
              ) : null}
            </div>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#fbfcfb] px-5 py-5">
          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading call details…
            </div>
          ) : error ? (
            <p className="text-[13px] leading-relaxed text-slate-600">{error}</p>
          ) : historyItem ? (
            <div className="space-y-6">
              {callNeedsPostCallReviewBanner(historyItem) ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-950">
                  {CALL_POST_PROCESSING_BANNER}
                </div>
              ) : null}

              <DetailSection title="Summary">
                <p className="text-[14px] leading-relaxed text-slate-700">
                  {summary ?? "No summary available."}
                </p>
              </DetailSection>

              <DetailSection title="Recording">
                <CallAudioPlayer
                  callLogId={historyItem.id}
                  hasRecording={historyItem.hasRecording}
                />
              </DetailSection>

              <DetailSection title="Transcript">
                {!safeTranscript && !showCleaned ? (
                  <p className="text-[13px] text-slate-500">No transcript available.</p>
                ) : (
                  <>
                    <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
                      Full conversation between Cara and the caller. Stored for 30 days.
                    </p>
                    <StaffTranscriptView
                      text={(showCleaned ? cleanedTranscript : safeTranscript) ?? ""}
                      scrollable
                    />
                    {hasCleanedToggle ? (
                      <button
                        type="button"
                        onClick={() => setShowCleanedTranscript((value) => !value)}
                        className="mt-2 text-[12px] font-medium text-[#0b1220] underline-offset-2 hover:underline"
                      >
                        {showCleaned
                          ? "Show full transcript"
                          : "Show cleaned transcript"}
                      </button>
                    ) : null}
                  </>
                )}
              </DetailSection>
            </div>
          ) : null}
        </div>

        {detail ? (
          <div className="shrink-0 border-t border-[#dfe7e2] bg-[#f6faf7] px-5 py-4">
            <Link
              href={`${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(detail.id)}`}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#b9c8c1] bg-[#fbfcfb] px-3 text-[13px] font-medium text-[#35443f] transition-colors hover:bg-white",
              )}
            >
              Open in Calls
            </Link>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function CallDetailsDialogButton({
  ticketId,
  callLogId,
  callerName,
  callerDisplay,
  className,
}: {
  ticketId: string;
  callLogId?: string | null;
  callerName: string;
  callerDisplay: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#b9c8c1] bg-[#fbfcfb] px-5 text-[14px] font-semibold text-[#35443f] transition-colors hover:bg-white",
          className,
        )}
      >
        <ScrollText className="size-4" aria-hidden />
        View call details
      </button>
      <CallDetailsDialog
        open={open}
        onOpenChange={setOpen}
        ticketId={ticketId}
        callLogId={callLogId}
        fallbackCallerName={callerName}
        fallbackCallerDisplay={callerDisplay}
      />
    </>
  );
}
