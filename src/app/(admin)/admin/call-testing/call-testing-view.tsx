"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Phone, RefreshCw, X } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminListCard } from "@/components/admin/admin-list-card";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminStatsGrid } from "@/components/admin/admin-stats-grid";
import {
  adminTableBodyClass,
  adminTableClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableThClass,
} from "@/components/admin/admin-table";
import {
  healthStatusLabel,
  healthStatusTone,
} from "@/lib/call-testing-health";
import type {
  CallTestListItem,
  CallTestReportRow,
} from "@/lib/call-testing-types";
import { INTERNAL_QA_LINE_E164, TEST_LINE_E164 } from "@/lib/call-testing-types";
import { cn } from "@/lib/utils";

import { rebuildRecentTestCallReports } from "./actions";

type CallTestingViewProps = {
  reports: CallTestReportRow[];
  listItems: CallTestListItem[];
  stats: {
    calls24h: number;
    passRate: number | null;
    avgGreetingMs: number | null;
    avgReplyP50: number | null;
    errorCount24h: number;
  };
  selectedReportId: string | null;
  variantFilter: string | null;
  callLogDetails: {
    transcript: string | null;
    transcriptReview: string | null;
    aiSummary: string | null;
    costEstimate: Record<string, unknown> | null;
  } | null;
};

type DetailTab = "overview" | "transcript" | "technical";

function formatTimeLabel(iso: string, withSeconds = false): string {
  try {
    return new Intl.DateTimeFormat("en-IE", {
      dateStyle: "medium",
      timeStyle: withSeconds ? "medium" : "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return `${Math.round(ms)} ms`;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function HealthBadge({
  status,
}: {
  status: CallTestListItem["healthStatus"];
}) {
  const tone = healthStatusTone(status);
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "danger" && "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {healthStatusLabel(status)}
    </span>
  );
}

export function CallTestingView({
  reports,
  listItems,
  stats,
  selectedReportId,
  variantFilter,
  callLogDetails,
}: CallTestingViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [transcriptTab, setTranscriptTab] = useState<"verbatim" | "reviewed">("reviewed");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [isRefreshing, startRefresh] = useTransition();

  const selectedReport = selectedReportId
    ? reports.find((r) => r.id === selectedReportId) ?? null
    : null;

  const selectedListItem = selectedReportId
    ? listItems.find((i) => i.id === selectedReportId) ?? null
    : null;

  const filteredItems = useMemo(() => {
    let items = listItems;
    if (variantFilter) {
      items = items.filter((item) => item.variantLabel === variantFilter);
    }
    if (reviewOnly) {
      items = items.filter((item) => item.needsReview);
    }
    return items;
  }, [listItems, variantFilter, reviewOnly]);

  const variants = useMemo(
    () =>
      Array.from(new Set(listItems.map((i) => i.variantLabel).filter(Boolean))).sort(),
    [listItems],
  );

  const navigate = useCallback(
    (patch: { report?: string | null; variant?: string | null }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (patch.report === null) params.delete("report");
      else if (patch.report) params.set("report", patch.report);
      if (patch.variant === null) params.delete("variant");
      else if (patch.variant) params.set("variant", patch.variant);
      const qs = params.toString();
      router.push(qs ? `/admin/call-testing?${qs}` : "/admin/call-testing");
    },
    [router, searchParams],
  );

  const selectReport = (reportId: string) => {
    setDetailTab("overview");
    navigate({ report: reportId, variant: variantFilter });
  };

  const clearSelection = () => {
    navigate({ report: null, variant: variantFilter });
  };

  const refreshDashboard = useCallback(() => {
    startRefresh(async () => {
      await rebuildRecentTestCallReports();
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void rebuildRecentTestCallReports().then(() => router.refresh());
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const copyTestLine = async () => {
    await navigator.clipboard.writeText(TEST_LINE_E164);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Phone className="size-4 text-gray-500" aria-hidden />
          <span className="font-medium">Public demo</span>
          <code className="rounded bg-gray-100 px-2 py-0.5 text-[13px]">{TEST_LINE_E164}</code>
        </div>
        <button
          type="button"
          onClick={() => void copyTestLine()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy demo line"}
        </button>
        <div className="text-sm text-gray-600">
          Internal SuperValu QA:{" "}
          <code className="rounded bg-gray-100 px-2 py-0.5 text-[13px]">
            {INTERNAL_QA_LINE_E164}
          </code>
        </div>
      </div>

      <AdminStatsGrid>
        <AdminStatCard label="Test calls (24h)" value={String(stats.calls24h)} />
        <AdminStatCard
          label="Pass rate"
          value={stats.passRate != null ? `${stats.passRate}%` : "—"}
        />
        <AdminStatCard label="Avg greeting" value={formatMs(stats.avgGreetingMs)} />
        <AdminStatCard label="Avg reply p50" value={formatMs(stats.avgReplyP50)} />
        <AdminStatCard label="Errors (24h)" value={String(stats.errorCount24h)} />
      </AdminStatsGrid>

      <AdminListCard
        countLabel={`${filteredItems.length} test call${filteredItems.length === 1 ? "" : "s"}`}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refreshDashboard()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
              Refresh
            </button>
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={reviewOnly}
                onChange={(e) => setReviewOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              Needs review only
            </label>
            {variants.length > 0 ? (
              <select
                value={variantFilter ?? ""}
                onChange={(e) =>
                  navigate({
                    variant: e.target.value || null,
                    report: selectedReport?.id ?? null,
                  })
                }
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
              >
                <option value="">All variants</option>
                {variants.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        }
        fillRemaining={false}
      >
        <table className={adminTableClass}>
          <thead>
            <tr>
              <th className={adminTableThClass}>Time</th>
              <th className={adminTableThClass}>Variant</th>
              <th className={adminTableThClass}>Verdict</th>
              <th className={adminTableThClass}>Greeting</th>
              <th className={adminTableThClass}>Reply p50</th>
              <th className={adminTableThClass}>Errors</th>
              <th className={adminTableThClass}>Duration</th>
            </tr>
          </thead>
          <tbody className={adminTableBodyClass}>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                  No test calls yet.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedReportId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      adminTableRowClass,
                      "cursor-pointer border-l-4",
                      isSelected
                        ? "!bg-sky-50 border-l-sky-600 hover:!bg-sky-50"
                        : "border-l-transparent hover:bg-gray-100/70",
                    )}
                    onClick={() => selectReport(item.id)}
                    aria-selected={isSelected}
                  >
                    <td className={adminTableTdClass}>
                      <span
                        className={cn(
                          "font-medium",
                          isSelected ? "text-sky-950" : "text-gray-900",
                        )}
                      >
                        {formatTimeLabel(item.createdAt, true)}
                      </span>
                      {item.needsReview ? (
                        <span className="ml-2 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                          Review
                        </span>
                      ) : null}
                    </td>
                    <td className={cn(adminTableTdClass, "text-gray-600")}>
                      {item.variantLabel}
                    </td>
                    <td className={adminTableTdClass}>
                      <HealthBadge status={item.healthStatus} />
                    </td>
                    <td className={cn(adminTableTdClass, "tabular-nums text-gray-600")}>
                      {formatMs(item.greetingMs)}
                    </td>
                    <td className={cn(adminTableTdClass, "tabular-nums text-gray-600")}>
                      {formatMs(item.replyP50)}
                    </td>
                    <td className={cn(adminTableTdClass, "tabular-nums text-gray-600")}>
                      {item.errorCount}
                    </td>
                    <td className={cn(adminTableTdClass, "tabular-nums text-gray-600")}>
                      {item.durationSeconds}s
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </AdminListCard>

      {selectedReport && selectedListItem ? (
        <AdminSectionCard
          title="Call detail"
          description={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <HealthBadge status={selectedReport.health_status} />
              <span>{formatTimeLabel(selectedReport.created_at, true)}</span>
              <span className="text-gray-400">·</span>
              <span>{selectedListItem.durationSeconds}s</span>
              <span className="text-gray-400">·</span>
              <span>{selectedListItem.callerNumber}</span>
              <span className="text-gray-400">·</span>
              <span>{selectedListItem.variantLabel}</span>
              <span className="text-gray-400">·</span>
              <span className="font-mono text-[11px]">{shortId(selectedReport.id)}</span>
            </span>
          }
          padded
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className="text-sm leading-relaxed text-gray-800">
              {selectedReport.health_reason ?? "No verdict reason recorded."}
            </p>
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close detail"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex gap-1 border-b border-gray-200">
            {(
              [
                ["overview", "Overview"],
                ["transcript", "Transcript"],
                ["technical", "Technical"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDetailTab(id)}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  detailTab === id
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <CallTestingDetail
              report={selectedReport}
              callLogDetails={callLogDetails}
              transcriptTab={transcriptTab}
              onTranscriptTabChange={setTranscriptTab}
              detailTab={detailTab}
            />
          </div>
        </AdminSectionCard>
      ) : null}
    </div>
  );
}

function formatEventOffset(atMs: number, callCreatedAt: string): string {
  const start = Date.parse(callCreatedAt);
  if (!Number.isFinite(start)) return new Date(atMs).toISOString();
  const offset = Math.max(0, atMs - start);
  if (offset < 1000) return `+${offset}ms`;
  return `+${(offset / 1000).toFixed(1)}s`;
}

function CallTestingDetail({
  report,
  callLogDetails,
  transcriptTab,
  onTranscriptTabChange,
  detailTab,
}: {
  report: CallTestReportRow;
  callLogDetails: CallTestingViewProps["callLogDetails"];
  transcriptTab: "verbatim" | "reviewed";
  onTranscriptTabChange: (tab: "verbatim" | "reviewed") => void;
  detailTab: DetailTab;
}) {
  const d = report.diagnostics;
  const qa = d?.transcriptQa;
  const events = d?.events ?? [];
  const errorEvents = events.filter((e) => e.level === "error");

  if (detailTab === "overview") {
    return (
      <div className="space-y-6">
        {qa ? (
          <section>
            <h3 className="text-sm font-semibold text-gray-900">What went wrong</h3>
            <p className="mt-2 text-sm text-gray-700">{qa.summary}</p>
            {qa.issues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                {qa.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section>
          <h3 className="text-sm font-semibold text-gray-900">Metrics</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <MetricRow label="Greeting" value={formatMs(report.latency?.greetingMs)} />
            <MetricRow label="Reply p50" value={formatMs(report.latency?.replyP50)} />
            <MetricRow label="Errors" value={String(report.error_count)} />
            <MetricRow label="Duration" value={`${report.duration_seconds}s`} />
            <MetricRow label="Greeting played" value={report.greeting_played ? "Yes" : "No"} />
            <MetricRow label="Disclosure" value={report.disclosure_confirmed ? "Yes" : "No"} />
            <MetricRow label="Greeting source" value={d?.greetingSource ?? "—"} />
          </dl>
        </section>

        {d?.transcriptIssues && d.transcriptIssues.length > 0 ? (
          <section>
            <h3 className="text-sm font-semibold text-gray-900">Transcript glitches</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {d.transcriptIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {d?.recommendedChecks && d.recommendedChecks.length > 0 ? (
          <section>
            <h3 className="text-sm font-semibold text-gray-900">Recommended checks</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {d.recommendedChecks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h3 className="text-sm font-semibold text-gray-900">Latency</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <MetricRow
              label="Reply p95"
              value={formatMs(report.latency?.replyP95)}
            />
            <MetricRow
              label="User→think"
              value={
                report.latency?.userSpeakingToThinkingMs?.length
                  ? formatMs(report.latency.userSpeakingToThinkingMs.at(-1))
                  : "—"
              }
            />
          </dl>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-900">Errors during call</h3>
          {errorEvents.length > 0 ? (
            <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
              {errorEvents.map((e) => (
                <li
                  key={`${e.atMs}-${e.tag}`}
                  className="px-3 py-2.5 text-sm text-gray-800"
                >
                  <span className="mr-2 font-mono text-xs text-red-700">
                    {formatEventOffset(e.atMs, report.created_at)}
                  </span>
                  {e.message || e.tag}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No pipeline errors recorded.</p>
          )}
        </section>

        {callLogDetails?.aiSummary ? (
          <section>
            <h3 className="text-sm font-semibold text-gray-900">AI summary</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">
              {callLogDetails.aiSummary}
            </p>
          </section>
        ) : null}
      </div>
    );
  }

  if (detailTab === "transcript") {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onTranscriptTabChange("reviewed")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              transcriptTab === "reviewed"
                ? "bg-gray-900 text-white"
                : "border border-gray-200 text-gray-700",
            )}
          >
            AI reviewed
          </button>
          <button
            type="button"
            onClick={() => onTranscriptTabChange("verbatim")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              transcriptTab === "verbatim"
                ? "bg-gray-900 text-white"
                : "border border-gray-200 text-gray-700",
            )}
          >
            Verbatim STT
          </button>
        </div>
        <div className="max-h-[480px] overflow-auto rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <TranscriptLines
            text={
              transcriptTab === "reviewed"
                ? callLogDetails?.transcriptReview?.trim() ||
                  callLogDetails?.transcript?.trim() ||
                  ""
                : callLogDetails?.transcript?.trim() || ""
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Collapsible title="Pipeline config">
        <div className="flex flex-wrap gap-2">
          {Object.entries(report.pipeline_snapshot ?? {}).map(([k, v]) => (
            <AdminBadge key={k} className="font-mono text-[11px]">
              {k}: {String(v)}
            </AdminBadge>
          ))}
        </div>
      </Collapsible>

      <Collapsible title={`Event timeline (${events.length})`} defaultOpen>
        <div className="max-h-64 space-y-1 overflow-auto">
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">No events.</p>
          ) : (
            events.map((e) => (
              <div
                key={`${e.atMs}-${e.tag}-${e.level}`}
                className={cn(
                  "rounded px-2 py-1.5 text-xs",
                  e.level === "error" && "bg-red-50 text-red-900",
                  e.level === "warn" && "bg-amber-50 text-amber-900",
                  e.level === "info" && "bg-gray-50 text-gray-800",
                )}
              >
                <span className="font-mono text-gray-500">
                  {formatEventOffset(e.atMs, report.created_at)}
                </span>{" "}
                <span className="font-medium">[{e.level}]</span> {e.tag}
                {e.message && e.message !== e.tag ? ` — ${e.message}` : ""}
              </div>
            ))
          )}
        </div>
      </Collapsible>

      <Collapsible title="Identifiers">
        <dl className="grid gap-3 sm:grid-cols-2">
          <TechField label="call_sid" value={report.call_sid} />
          <TechField label="room_name" value={report.room_name} />
          <TechField label="call_log_id" value={report.call_log_id} />
          <TechField label="caller" value={report.caller_number} />
        </dl>
      </Collapsible>

      <Collapsible title="Raw diagnostics">
        <pre className="max-h-56 overflow-auto rounded bg-gray-950 p-3 text-[11px] text-gray-100">
          {JSON.stringify(d ?? {}, null, 2)}
        </pre>
      </Collapsible>
    </div>
  );
}

function TranscriptLines({ text }: { text: string }) {
  if (!text) {
    return <p className="text-sm text-gray-500">No transcript captured.</p>;
  }
  return (
    <div className="space-y-2">
      {text.split("\n").map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const isCaller = /^Caller:/i.test(trimmed);
        const isAssistant = /^Assistant:/i.test(trimmed);
        return (
          <p
            key={`${i}-${trimmed.slice(0, 24)}`}
            className={cn(
              "text-sm leading-relaxed",
              isCaller && "text-blue-900",
              isAssistant && "text-emerald-900",
              !isCaller && !isAssistant && "text-gray-700",
            )}
          >
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded-lg border border-gray-200 bg-white"
      open={defaultOpen || undefined}
    >
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-gray-800">
        {title}
      </summary>
      <div className="border-t border-gray-100 px-3 py-3">{children}</div>
    </details>
  );
}

function TechField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-xs text-gray-800">{value?.trim() || "—"}</dd>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-gray-900">{value}</dd>
    </div>
  );
}
