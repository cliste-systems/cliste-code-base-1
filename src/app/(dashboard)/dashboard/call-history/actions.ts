"use server";

import {
  inferCallIntent,
  mapCallLogToRow,
  normalizeCallOutcome,
  OUTCOME_LABELS,
} from "@/lib/call-history-types";
import {
  buildCallerHistoryInsight,
  type CallerHistoryInsight,
} from "@/lib/caller-history-insight";
import {
  ANONYMOUS_CALLER_E164,
  normalizeBlockedCallerE164,
} from "@/lib/blocked-callers";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { createCallRecordingSignedUrl } from "@/lib/call-recordings-server";
import { resolveCallLogIdForTicket } from "@/lib/resolve-ticket-call-log";
import type { PostCallStatus } from "@/lib/post-call-processing-types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CallHistoryDetailPayload = {
  transcriptVerbatim: string;
  transcriptReview: string | null;
} | null;

export type CallDetailDialogPayload = {
  id: string;
  dateTimeLabel: string;
  callerDisplay: string;
  callerName: string | null;
  durationLabel: string;
  durationSeconds: number;
  outcome: ReturnType<typeof normalizeCallOutcome>;
  outcomeLabel: string;
  intentLabel: string;
  aiSummary: string | null;
  transcriptVerbatim: string;
  transcriptReview: string | null;
  postCallStatus: PostCallStatus;
  hasRecording: boolean;
};

export type CallRecordingPlaybackResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

const CALLER_HISTORY_CALL_LIMIT = 30;

export async function fetchCallerHistoryInsight(input: {
  callerNumber: string;
  excludeCallId?: string;
}): Promise<CallerHistoryInsight> {
  const callerNumber = String(input.callerNumber ?? "").trim();
  if (!callerNumber || callerNumber === ANONYMOUS_CALLER_E164) {
    return buildCallerHistoryInsight({
      callerNumber: ANONYMOUS_CALLER_E164,
      calls: [],
      openTickets: [],
      isBlocked: false,
      abuseHitCount: 0,
    });
  }

  const callerE164 = normalizeBlockedCallerE164(callerNumber);
  if (!callerE164) {
    return buildCallerHistoryInsight({
      callerNumber: ANONYMOUS_CALLER_E164,
      calls: [],
      openTickets: [],
      isBlocked: false,
      abuseHitCount: 0,
    });
  }

  const { supabase, organizationId } = await requireDashboardSession();

  const [{ data: callRows }, { data: ticketRows }, { data: blockedRow }, { data: abuseRow }] =
    await Promise.all([
    supabase
      .from("call_logs")
      .select(
        "id, caller_name, outcome, ai_summary, duration_seconds, created_at, post_call_status",
      )
      .eq("organization_id", organizationId)
      .eq("caller_number", callerE164)
      .order("created_at", { ascending: false })
      .limit(CALLER_HISTORY_CALL_LIMIT),
    supabase
      .from("action_tickets")
      .select("status, summary, department_slug")
      .eq("organization_id", organizationId)
      .eq("caller_number", callerE164)
      .order("created_at", { ascending: false })
      .limit(CALLER_HISTORY_CALL_LIMIT),
    supabase
      .from("blocked_callers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("caller_e164", callerE164)
      .maybeSingle(),
    supabase
      .from("caller_abuse_signals")
      .select("hit_count")
      .eq("organization_id", organizationId)
      .eq("caller_number", callerE164)
      .maybeSingle(),
  ]);

  return buildCallerHistoryInsight({
    callerNumber: callerE164,
    calls: (callRows ?? []).map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at ?? ""),
      callerName: row.caller_name?.trim() || null,
      outcome: String(row.outcome ?? ""),
      aiSummary: row.ai_summary?.trim() || null,
      durationSeconds: Number(row.duration_seconds ?? 0),
      postCallStatus: (row.post_call_status as PostCallStatus) ?? "complete",
    })),
    openTickets: (ticketRows ?? []).map((row) => ({
      status: String(row.status ?? ""),
      summary: String(row.summary ?? ""),
      departmentSlug: row.department_slug?.trim() || null,
    })),
    isBlocked: Boolean(blockedRow),
    abuseHitCount: Number(abuseRow?.hit_count ?? 0),
  });
}

export async function fetchCallRecordingPlaybackUrl(
  callLogId: string,
): Promise<CallRecordingPlaybackResult> {
  const id = callLogId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, message: "Recording not available for this call." };
  }

  const { supabase, organizationId } = await requireDashboardSession();
  const { data, error } = await supabase
    .from("call_logs")
    .select("audio_storage_path")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const storagePath = data?.audio_storage_path?.trim();
  if (error || !storagePath) {
    return { ok: false, message: "Recording not available for this call." };
  }

  const url = await createCallRecordingSignedUrl({
    organizationId,
    callLogId: id,
    storagePath,
  });
  if (!url) {
    return { ok: false, message: "Recording not available for this call." };
  }

  return { ok: true, url };
}

/**
 * Loads transcript fields for one call (list queries omit these to reduce egress).
 */
export async function fetchCallHistoryDetail(
  callId: string,
): Promise<CallHistoryDetailPayload> {
  const detail = await loadCallDetailRow(callId);
  if (!detail) return null;

  return {
    transcriptVerbatim: detail.transcriptVerbatim,
    transcriptReview: detail.transcriptReview,
  };
}

/**
 * Full call detail for department/action inbox "View call details".
 * Resolves call_log_id from the ticket when missing (older tickets).
 */
export async function fetchCallDetailForTicket(input: {
  ticketId: string;
  callLogId?: string | null;
}): Promise<CallDetailDialogPayload | null> {
  const ticketId = input.ticketId.trim();
  if (!UUID_RE.test(ticketId)) return null;

  const { supabase, organizationId } = await requireDashboardSession();
  const callLogId =
    (input.callLogId?.trim() && UUID_RE.test(input.callLogId.trim())
      ? input.callLogId.trim()
      : null) ??
    (await resolveCallLogIdForTicket(supabase, organizationId, ticketId));

  if (!callLogId) return null;

  const detail = await loadCallDetailRow(callLogId);
  if (!detail) return null;

  return detail;
}

async function loadCallDetailRow(callId: string): Promise<CallDetailDialogPayload | null> {
  const id = callId.trim();
  if (!UUID_RE.test(id)) return null;

  const { supabase, organizationId } = await requireDashboardSession();

  const { data, error } = await supabase
    .from("call_logs")
    .select(
      "id, caller_number, caller_name, duration_seconds, outcome, ai_summary, transcript, transcript_review, created_at, post_call_status, audio_storage_path",
    )
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) return null;

  const mapped = mapCallLogToRow({
    id: String(data.id),
    caller_number: String(data.caller_number ?? ""),
    duration_seconds: Math.max(0, Number(data.duration_seconds ?? 0)),
    outcome: String(data.outcome ?? ""),
    transcript: data.transcript ?? null,
    transcript_review: data.transcript_review ?? null,
    ai_summary: data.ai_summary ?? null,
    created_at: String(data.created_at ?? ""),
  });

  const outcome = normalizeCallOutcome(String(data.outcome ?? ""));
  const aiSummary = data.ai_summary?.trim() || null;

  return {
    id: mapped.id,
    dateTimeLabel: mapped.dateTimeLabel,
    callerDisplay: mapped.callerDisplay || "Unknown number",
    callerName: data.caller_name?.trim() || null,
    durationLabel: mapped.durationLabel || "—",
    durationSeconds: Math.max(0, Number(data.duration_seconds ?? 0)),
    outcome,
    outcomeLabel: OUTCOME_LABELS[outcome],
    intentLabel: mapped.intentLabel || inferCallIntent(aiSummary, outcome),
    aiSummary,
    transcriptVerbatim: mapped.transcriptVerbatim,
    transcriptReview: mapped.transcriptReview,
    postCallStatus: (data.post_call_status as PostCallStatus) ?? "complete",
    hasRecording: Boolean(data.audio_storage_path?.trim()),
  };
}
