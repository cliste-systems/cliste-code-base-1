import { computeCallTestHealth } from "@/lib/call-testing-health";
import { enrichCallTestDiagnostics } from "@/lib/call-testing-enrich";
import { assessTranscriptQuality } from "@/lib/call-transcript-qa";
import type {
  CallCloseDiagnosticsPayload,
  CallTestHealthStatus,
} from "@/lib/call-testing-types";
import type { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

function countDiagnosticErrors(diagnostics: CallCloseDiagnosticsPayload | null): number {
  return diagnostics?.events?.filter((e) => e.level === "error").length ?? 0;
}

export async function persistCallTestReport(input: {
  admin: AdminClient;
  callLogId: string;
  orgId: string;
  body: {
    called_number?: string;
    caller_number: string;
    call_sid?: string | null;
    room_name?: string | null;
    duration_seconds?: number;
    transcript?: string | null;
    transcript_review?: string | null;
    ai_summary?: string | null;
    cost_estimate?: Record<string, unknown> | null;
    disclosure_confirmed?: boolean;
    test_profile_id?: string | null;
    variant_label?: string | null;
    diagnostics?: CallCloseDiagnosticsPayload | null;
    created_at?: string | null;
    business_name?: string | null;
  };
}): Promise<{ healthStatus: CallTestHealthStatus; healthReason: string } | null> {
  const durationSeconds = Math.max(0, input.body.duration_seconds ?? 0);

  let transcriptReview = input.body.transcript_review ?? null;
  let aiSummary = input.body.ai_summary ?? null;
  let costEstimate = input.body.cost_estimate ?? null;
  let createdAt = input.body.created_at ?? null;
  let businessName = input.body.business_name ?? null;

  if (!transcriptReview || !aiSummary || !costEstimate || !createdAt || !businessName) {
    const { data: callLog } = await input.admin
      .from("call_logs")
      .select(
        "transcript_review, ai_summary, cost_estimate, created_at, transcript, call_sid, room_name, called_number, organization_id, organizations ( name )",
      )
      .eq("id", input.callLogId)
      .maybeSingle();
    if (callLog) {
      transcriptReview = transcriptReview ?? (callLog.transcript_review as string | null);
      aiSummary = aiSummary ?? (callLog.ai_summary as string | null);
      costEstimate =
        costEstimate ?? (callLog.cost_estimate as Record<string, unknown> | null);
      createdAt = createdAt ?? (callLog.created_at as string | null);
      if (!input.body.transcript?.trim() && callLog.transcript) {
        input.body.transcript = callLog.transcript as string;
      }
      if (!input.body.call_sid && callLog.call_sid) {
        input.body.call_sid = callLog.call_sid as string;
      }
      if (!input.body.room_name && callLog.room_name) {
        input.body.room_name = callLog.room_name as string;
      }
      if (!input.body.called_number && callLog.called_number) {
        input.body.called_number = callLog.called_number as string;
      }
      const org = callLog.organizations as { name?: string } | { name?: string }[] | null;
      businessName =
        businessName ??
        (Array.isArray(org) ? org[0]?.name : org?.name) ??
        null;
    }
  }

  if (!businessName) {
    const { data: org } = await input.admin
      .from("organizations")
      .select("name")
      .eq("id", input.orgId)
      .maybeSingle();
    businessName = (org?.name as string | null) ?? null;
  }

  const diagnostics = await enrichCallTestDiagnostics({
    admin: input.admin,
    orgId: input.orgId,
    callLogId: input.callLogId,
    calledNumber: input.body.called_number,
    callerNumber: input.body.caller_number,
    callSid: input.body.call_sid,
    roomName: input.body.room_name,
    transcript: input.body.transcript ?? null,
    transcriptReview,
    aiSummary,
    costEstimate,
    workerDiagnostics: input.body.diagnostics ?? null,
    createdAtIso: createdAt,
    durationSeconds,
  });

  const transcriptQa = assessTranscriptQuality({
    transcript: input.body.transcript ?? null,
    transcriptReview,
    aiSummary,
    durationSeconds,
    businessName,
  });

  diagnostics.transcriptQa = transcriptQa;

  const { status, reason } = computeCallTestHealth({
    durationSeconds,
    diagnostics,
    transcript: input.body.transcript ?? null,
    transcriptReview,
    businessName,
  });

  const latency = diagnostics.latency ?? {};
  const pipelineSnapshot = diagnostics.pipeline ?? {};

  const row = {
    call_log_id: input.callLogId,
    organization_id: input.orgId,
    test_profile_id: input.body.test_profile_id?.trim() || null,
    variant_label: input.body.variant_label?.trim() || null,
    called_number: input.body.called_number?.trim() || null,
    caller_number: input.body.caller_number?.trim() || null,
    call_sid: input.body.call_sid?.trim() || null,
    room_name: input.body.room_name?.trim() || null,
    health_status: status,
    health_reason: reason,
    latency,
    pipeline_snapshot: pipelineSnapshot,
    diagnostics,
    error_count: countDiagnosticErrors(diagnostics),
    greeting_played: diagnostics.greetingPlayed === true,
    disclosure_confirmed: input.body.disclosure_confirmed === true,
    duration_seconds: durationSeconds,
    needs_review: transcriptQa.needsReview,
  };

  const { error } = await input.admin.from("call_test_reports").upsert(row, {
    onConflict: "call_log_id",
  });

  if (error) {
    console.error("[call-testing] persist report failed", error.message);
    return null;
  }

  await input.admin
    .from("call_logs")
    .update({
      is_test_call: true,
      called_number: input.body.called_number?.trim() || null,
    })
    .eq("id", input.callLogId);

  return { healthStatus: status, healthReason: reason };
}
