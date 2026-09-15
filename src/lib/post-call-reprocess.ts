import {
  buildActionTicketBriefSummary,
  revalidateActionTicketSurfaces,
  resolveActionTicketDepartment,
} from "@/lib/action-ticket-routing";
import type { PostCallStatus } from "@/lib/post-call-processing-types";
import { redactCallText } from "@/lib/transcript-redaction";
import { stripToolLinesFromTranscript } from "@/lib/transcript-display";
import { createAdminClient } from "@/utils/supabase/admin";

type ReprocessResult =
  | { ok: true; ticketId: string; departmentSlug: string | null }
  | { ok: false; message: string };

function extractCallerName(transcript: string): string | null {
  for (const line of transcript.split("\n")) {
    const match = line.match(
      /^Caller:\s*(?:my name is\s+|i'm\s+|this is\s+)([A-Za-z][A-Za-z'-]{1,30})\.?$/i,
    );
    if (match?.[1]) return match[1];
  }
  return null;
}

function inferSummaryFromTranscript(transcript: string): string | null {
  const blob = transcript.toLowerCase();
  if (/\bbirthday cake\b|\bcake order\b|\border for a cake\b/.test(blob)) {
    return "Birthday cake order\nDetails recovered from call transcript during manual review.";
  }
  if (/\bbutcher\b|\bsteak\b|\bsirloin\b/.test(blob)) {
    return "Butcher order — callback\nDetails recovered from call transcript during manual review.";
  }
  if (/\bcomplaint\b|\bmanager\b|\brefund\b/.test(blob)) {
    return "Complaint — manager callback\nDetails recovered from call transcript during manual review.";
  }
  return null;
}

export async function reprocessCallLogPostCall(callLogId: string): Promise<ReprocessResult> {
  const admin = createAdminClient();
  const { data: callRow, error: callErr } = await admin
    .from("call_logs")
    .select("id, organization_id, caller_number, caller_name, transcript, post_call_status")
    .eq("id", callLogId)
    .maybeSingle();

  if (callErr || !callRow?.id) {
    return { ok: false, message: "Call log not found." };
  }

  const transcript = stripToolLinesFromTranscript(String(callRow.transcript ?? ""));
  if (!transcript.trim()) {
    return { ok: false, message: "Call has no transcript to reprocess." };
  }

  const summaryRaw = inferSummaryFromTranscript(transcript);
  if (!summaryRaw) {
    return { ok: false, message: "Could not infer an order or callback from the transcript." };
  }

  const summaryRedacted = redactCallText(summaryRaw);
  const summaryText = summaryRedacted.text ?? summaryRaw;
  const callerName =
    String(callRow.caller_name ?? "").trim() ||
    extractCallerName(transcript) ||
    null;

  const departmentSlug = await resolveActionTicketDepartment({
    summary: summaryText,
    routeId: null,
  });
  const briefSummary = buildActionTicketBriefSummary(summaryText);

  const { data: existingTicket } = await admin
    .from("action_tickets")
    .select("id")
    .eq("call_log_id", callLogId)
    .maybeSingle();

  let ticketId = existingTicket?.id as string | undefined;
  if (!ticketId) {
    const { data: inserted, error: insertErr } = await admin
      .from("action_tickets")
      .insert({
        organization_id: callRow.organization_id,
        caller_number: callRow.caller_number,
        caller_name: callerName,
        summary: summaryText,
        brief_summary: briefSummary,
        department_slug: departmentSlug,
        status: "open",
        call_log_id: callLogId,
        delivery_status: "confirmed",
        engineering_priority: "urgent",
      })
      .select("id")
      .single();
    if (insertErr || !inserted?.id) {
      return { ok: false, message: insertErr?.message ?? "Failed to create action ticket." };
    }
    ticketId = inserted.id as string;
  } else {
    await admin
      .from("action_tickets")
      .update({
        summary: summaryText,
        brief_summary: briefSummary,
        department_slug: departmentSlug,
        delivery_status: "confirmed",
        status: "open",
      })
      .eq("id", ticketId);
  }

  const nextStatus: PostCallStatus = "complete";
  const patch: Record<string, unknown> = {
    post_call_status: nextStatus,
    post_call_errors: [],
    post_call_expected_ticket: true,
    outcome: "action_created",
  };
  if (
    callRow.post_call_status === "partial" ||
    callRow.post_call_status === "failed"
  ) {
    patch.ai_summary = "Order recovered during Hello Cara post-call review.";
  }
  await admin.from("call_logs").update(patch).eq("id", callLogId);

  revalidateActionTicketSurfaces(departmentSlug);
  return { ok: true, ticketId, departmentSlug };
}
