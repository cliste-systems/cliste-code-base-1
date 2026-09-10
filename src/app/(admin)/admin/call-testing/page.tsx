import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";

import { AdminErrorCard, AdminPageShell } from "@/components/admin/admin-page-shell";
import { PRODUCT_NAME } from "@/lib/company-details";
import type {
  CallTestListItem,
  CallTestReportRow,
} from "@/lib/call-testing-types";
import { createAdminClient } from "@/utils/supabase/admin";

import { syncMissingTestCallReports } from "@/lib/call-testing-sync";

import { CallTestingView } from "./call-testing-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Call testing`,
};

type CallTestingPageProps = {
  searchParams?: Promise<{ report?: string; variant?: string }>;
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

function toListItem(
  row: CallTestReportRow & {
    organizations?: { name: string } | { name: string }[] | null;
    call_logs?: { created_at: string } | { created_at: string }[] | null;
  },
): CallTestListItem {
  const org = row.organizations;
  const orgName = Array.isArray(org) ? org[0]?.name : org?.name;
  const callLog = row.call_logs;
  const callLogCreatedAt = Array.isArray(callLog)
    ? callLog[0]?.created_at
    : callLog?.created_at;
  const createdAt = callLogCreatedAt ?? row.created_at;
  return {
    id: row.id,
    callLogId: row.call_log_id,
    createdAt,
    timeLabel: formatTimeLabel(createdAt),
    variantLabel: row.variant_label?.trim() || "Default",
    healthStatus: row.health_status,
    healthReason: row.health_reason,
    greetingMs: row.latency?.greetingMs ?? null,
    replyP50: row.latency?.replyP50 ?? null,
    errorCount: row.error_count,
    durationSeconds: row.duration_seconds,
    callerNumber: row.caller_number?.trim() || "Unknown",
    orgName: orgName?.trim() || "Unknown tenant",
    needsReview: row.needs_review === true,
  };
}

export default async function CallTestingPage({ searchParams }: CallTestingPageProps) {
  const sp = searchParams ? await searchParams : {};
  const selectedReportId =
    typeof sp.report === "string" && sp.report.trim() ? sp.report.trim() : null;
  const variantFilter =
    typeof sp.variant === "string" && sp.variant.trim() ? sp.variant.trim() : null;

  let loadError: string | null = null;
  let reports: (CallTestReportRow & {
    organizations?: { name: string } | { name: string }[] | null;
    call_logs?: { created_at: string } | { created_at: string }[] | null;
  })[] = [];
  let listItems: CallTestListItem[] = [];
  let stats = {
    calls24h: 0,
    passRate: null as number | null,
    avgGreetingMs: null as number | null,
    avgReplyP50: null as number | null,
    errorCount24h: 0,
  };
  let callLogDetails: {
    transcript: string | null;
    transcriptReview: string | null;
    aiSummary: string | null;
    costEstimate: Record<string, unknown> | null;
  } | null = null;

  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const admin = createAdminClient();

    await syncMissingTestCallReports(admin);

    const [reportsRes, recentRes] = await Promise.all([
      admin
        .from("call_test_reports")
        .select("*, organizations ( name ), call_logs ( created_at )")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("call_test_reports")
        .select("health_status, latency, error_count")
        .gte("created_at", dayAgoIso),
    ]);

    if (reportsRes.error) throw reportsRes.error;
    if (recentRes.error) throw recentRes.error;

    reports = (reportsRes.data ?? []) as typeof reports;
    listItems = reports.map(toListItem);

    const recent = recentRes.data ?? [];
    stats.calls24h = recent.length;
    stats.errorCount24h = recent.reduce(
      (sum, row) => sum + (typeof row.error_count === "number" ? row.error_count : 0),
      0,
    );
    const passCount = recent.filter((r) => r.health_status === "pass").length;
    stats.passRate = recent.length > 0 ? Math.round((passCount / recent.length) * 100) : null;

    const greetingSamples = recent
      .map((r) => (r.latency as { greetingMs?: number } | null)?.greetingMs)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (greetingSamples.length > 0) {
      stats.avgGreetingMs = Math.round(
        greetingSamples.reduce((a, b) => a + b, 0) / greetingSamples.length,
      );
    }

    const replySamples = recent
      .map((r) => (r.latency as { replyP50?: number } | null)?.replyP50)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (replySamples.length > 0) {
      stats.avgReplyP50 = Math.round(
        replySamples.reduce((a, b) => a + b, 0) / replySamples.length,
      );
    }

    const selected = selectedReportId
      ? reports.find((r) => r.id === selectedReportId) ?? null
      : null;
    if (selected?.call_log_id) {
      const { data: callLog } = await admin
        .from("call_logs")
        .select("transcript, transcript_review, ai_summary, cost_estimate")
        .eq("id", selected.call_log_id)
        .maybeSingle();
      if (callLog) {
        callLogDetails = {
          transcript: (callLog.transcript as string | null) ?? null,
          transcriptReview: (callLog.transcript_review as string | null) ?? null,
          aiSummary: (callLog.ai_summary as string | null) ?? null,
          costEstimate: (callLog.cost_estimate as Record<string, unknown> | null) ?? null,
        };
      }
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load call testing data";
  }

  const effectiveSelectedId = selectedReportId;

  return (
    <AdminPageShell
      icon={FlaskConical}
      title="Call testing"
      description="Public demo line for Hello Cara. Ring to hear Cara showcase AI phone capabilities — calls may be recorded and transcribed. QA metrics and variant comparison below."
    >
      {loadError ? (
        <AdminErrorCard message={loadError} />
      ) : (
        <CallTestingView
          reports={reports as CallTestReportRow[]}
          listItems={listItems}
          stats={stats}
          selectedReportId={effectiveSelectedId}
          variantFilter={variantFilter}
          callLogDetails={callLogDetails}
        />
      )}
    </AdminPageShell>
  );
}
