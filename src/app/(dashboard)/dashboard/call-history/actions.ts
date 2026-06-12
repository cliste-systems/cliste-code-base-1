"use server";

import { requireDashboardSession } from "@/lib/dashboard-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CallHistoryDetailPayload = {
  transcriptVerbatim: string;
  transcriptReview: string | null;
} | null;

/**
 * Loads transcript fields for one call (list queries omit these to reduce egress).
 */
export async function fetchCallHistoryDetail(
  callId: string,
): Promise<CallHistoryDetailPayload> {
  const id = callId.trim();
  if (!UUID_RE.test(id)) return null;

  const { supabase, organizationId } = await requireDashboardSession();

  const { data, error } = await supabase
    .from("call_logs")
    .select("transcript, transcript_review")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) return null;

  const verbatim = data.transcript?.trim() || "";
  return {
    transcriptVerbatim: verbatim || "No transcript on file.",
    transcriptReview: data.transcript_review?.trim() ?? null,
  };
}
