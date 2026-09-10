import { persistCallTestReport } from "@/lib/call-testing-persist";
import { TEST_LINE_E164 } from "@/lib/call-testing-types";
import type { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Pull recent call_logs for the test-line org into call_test_reports when missing. */
export async function syncMissingTestCallReports(
  admin: AdminClient,
  opts?: { sinceHours?: number; limit?: number },
): Promise<number> {
  const sinceHours = opts?.sinceHours ?? 24 * 7;
  const limit = opts?.limit ?? 30;
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  const { data: phoneRow } = await admin
    .from("phone_numbers")
    .select("organization_id")
    .eq("e164", TEST_LINE_E164)
    .maybeSingle();

  const orgId = phoneRow?.organization_id as string | undefined;
  if (!orgId) return 0;

  const { data: calls, error } = await admin
    .from("call_logs")
    .select(
      "id, caller_number, duration_seconds, transcript, call_sid, room_name, called_number, created_at, cost_estimate, transcript_review, ai_summary, is_test_call",
    )
    .eq("organization_id", orgId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !calls?.length) return 0;

  const callLogIds = calls.map((c) => c.id as string);
  const { data: existing } = await admin
    .from("call_test_reports")
    .select("call_log_id")
    .in("call_log_id", callLogIds);

  const reported = new Set((existing ?? []).map((r) => r.call_log_id as string));
  let count = 0;

  for (const call of calls) {
    const callLogId = call.id as string;
    if (reported.has(callLogId)) continue;

    const result = await persistCallTestReport({
      admin,
      callLogId,
      orgId,
      body: {
        called_number: (call.called_number as string | null) || TEST_LINE_E164,
        caller_number: (call.caller_number as string) ?? "unknown",
        call_sid: (call.call_sid as string | null) ?? null,
        room_name: (call.room_name as string | null) ?? null,
        duration_seconds: (call.duration_seconds as number) ?? 0,
        transcript: (call.transcript as string | null) ?? null,
        transcript_review: (call.transcript_review as string | null) ?? null,
        ai_summary: (call.ai_summary as string | null) ?? null,
        cost_estimate: (call.cost_estimate as Record<string, unknown> | null) ?? null,
        created_at: (call.created_at as string) ?? null,
        variant_label: "Production default",
      },
    });
    if (result) count += 1;
  }

  return count;
}
