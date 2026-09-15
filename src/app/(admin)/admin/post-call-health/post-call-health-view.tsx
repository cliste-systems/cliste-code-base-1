"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminListCard } from "@/components/admin/admin-list-card";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import {
  adminTableBodyClass,
  adminTableClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableThClass,
} from "@/components/admin/admin-table";
import type { PostCallHealthRow } from "@/lib/post-call-health";
import type { PostCallStatus } from "@/lib/post-call-processing-types";
import { stripToolLinesFromTranscript } from "@/lib/transcript-display";
import { cn } from "@/lib/utils";

import { reprocessPostCallHealthRow } from "./actions";

type PostCallHealthViewProps = {
  rows: PostCallHealthRow[];
  selectedCallId: string | null;
  selectedTranscript: string | null;
};

function formatTimeLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusTone(status: PostCallStatus): "danger" | "warning" | "neutral" {
  if (status === "failed") return "danger";
  if (status === "partial") return "warning";
  return "neutral";
}

function statusLabel(status: PostCallStatus): string {
  switch (status) {
    case "failed":
      return "Failed";
    case "partial":
      return "Partial";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function PostCallHealthView({
  rows,
  selectedCallId,
  selectedTranscript,
}: PostCallHealthViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedCallId) ?? null,
    [rows, selectedCallId],
  );

  function openRow(callId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("call", callId);
    router.push(`/admin/post-call-health?${params.toString()}`);
  }

  function onReprocess(callId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await reprocessPostCallHealthRow(callId);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage("Reprocessed — ticket repaired and call marked complete.");
      router.refresh();
    });
  }

  const transcript = stripToolLinesFromTranscript(selectedTranscript ?? "");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <AdminListCard
        countLabel={`${rows.length} issue${rows.length === 1 ? "" : "s"} · last 7 days`}
        className="min-h-0 flex-1 lg:max-w-[58%]"
      >
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            No post-call processing failures in the last 7 days.
          </p>
        ) : (
          <div className="min-h-0 overflow-auto">
            <table className={adminTableClass}>
              <thead>
                <tr>
                  <th className={adminTableThClass}>When</th>
                  <th className={adminTableThClass}>Tenant</th>
                  <th className={adminTableThClass}>Caller</th>
                  <th className={adminTableThClass}>Status</th>
                  <th className={adminTableThClass}>Ticket</th>
                </tr>
              </thead>
              <tbody className={adminTableBodyClass}>
                {rows.map((row) => {
                  const active = row.id === selectedCallId;
                  const missingTicket =
                    row.postCallExpectedTicket && !row.hasLinkedTicket;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        adminTableRowClass,
                        active && "bg-slate-50",
                        "cursor-pointer",
                      )}
                      onClick={() => openRow(row.id)}
                    >
                      <td className={adminTableTdClass}>
                        <span className="block text-[13px] text-[#0b1220]">
                          {formatTimeLabel(row.createdAt)}
                        </span>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          {formatDuration(row.durationSeconds)}
                        </span>
                      </td>
                      <td className={adminTableTdClass}>{row.organizationName}</td>
                      <td className={adminTableTdClass}>
                        <span className="block text-[13px]">
                          {row.callerName?.trim() || row.callerNumber}
                        </span>
                        {row.callerName?.trim() ? (
                          <span className="text-[11px] text-slate-500">
                            {row.callerNumber}
                          </span>
                        ) : null}
                      </td>
                      <td className={adminTableTdClass}>
                        <AdminBadge tone={statusTone(row.postCallStatus)}>
                          {statusLabel(row.postCallStatus)}
                        </AdminBadge>
                      </td>
                      <td className={adminTableTdClass}>
                        {missingTicket ? (
                          <AdminBadge tone="danger">Missing</AdminBadge>
                        ) : row.hasLinkedTicket ? (
                          <AdminBadge tone="neutral">Linked</AdminBadge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminListCard>

      <AdminSectionCard
        title="Call detail"
        description="Review errors, transcript, and re-run post-call repair."
        className="min-h-0 flex-1 lg:max-w-[42%]"
      >
        {!selected ? (
          <p className="text-sm text-slate-500">
            Select a row to inspect the transcript and reprocess.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <AdminBadge tone={statusTone(selected.postCallStatus)}>
                {statusLabel(selected.postCallStatus)}
              </AdminBadge>
              {selected.postCallExpectedTicket && !selected.hasLinkedTicket ? (
                <AdminBadge tone="danger">Expected ticket missing</AdminBadge>
              ) : null}
            </div>

            {selected.postCallErrors.length > 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-red-800">
                  Error stages
                </p>
                <ul className="mt-2 space-y-1.5">
                  {selected.postCallErrors.map((entry, index) => (
                    <li key={`${entry.stage}-${index}`} className="text-[13px] text-red-900">
                      <span className="font-medium">{entry.stage}</span>
                      <span className="text-red-700"> — {entry.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {selected.aiSummary?.trim() ? (
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  AI summary
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                  {selected.aiSummary}
                </p>
              </div>
            ) : null}

            <div className="min-h-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Transcript
              </p>
              <pre className="mt-2 max-h-[320px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] leading-relaxed whitespace-pre-wrap text-slate-800">
                {transcript || "No transcript on file."}
              </pre>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => onReprocess(selected.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0b1220] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#111827] disabled:opacity-60"
              >
                <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden />
                Reprocess
              </button>
              {message ? (
                <p className="text-[13px] text-slate-600">{message}</p>
              ) : null}
            </div>

            {selected.postCallExpectedTicket && !selected.hasLinkedTicket ? (
              <p className="flex items-start gap-2 text-[12px] text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                This call expected a shop ticket but none is linked — reprocess will create or repair it.
              </p>
            ) : null}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
