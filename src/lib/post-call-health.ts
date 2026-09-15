import type { PostCallErrorEntry, PostCallStatus } from "@/lib/post-call-processing-types";
import { parsePostCallErrors } from "@/lib/post-call-processing-types";
import { createAdminClient } from "@/utils/supabase/admin";

export type PostCallHealthRow = {
  id: string;
  organizationId: string;
  organizationName: string;
  createdAt: string;
  callerNumber: string;
  callerName: string | null;
  durationSeconds: number;
  outcome: string;
  postCallStatus: PostCallStatus;
  postCallExpectedTicket: boolean;
  postCallErrors: PostCallErrorEntry[];
  hasLinkedTicket: boolean;
  aiSummary: string | null;
};

const HEALTH_STATUSES: PostCallStatus[] = ["partial", "failed", "pending"];

export async function loadPostCallHealthRows(limit = 40): Promise<PostCallHealthRow[]> {
  const admin = createAdminClient();
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: calls, error } = await admin
    .from("call_logs")
    .select(
      "id, organization_id, created_at, caller_number, caller_name, duration_seconds, outcome, post_call_status, post_call_expected_ticket, post_call_errors, ai_summary, organizations(name)",
    )
    .in("post_call_status", HEALTH_STATUSES)
    .gte("created_at", weekAgoIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!calls?.length) return [];

  const callIds = calls.map((row) => row.id as string);
  const { data: tickets } = await admin
    .from("action_tickets")
    .select("call_log_id")
    .in("call_log_id", callIds);

  const linked = new Set(
    (tickets ?? [])
      .map((row) => row.call_log_id as string | null)
      .filter(Boolean),
  );

  return calls.map((row) => {
    const org = row.organizations as { name: string } | { name: string }[] | null;
    const orgName = Array.isArray(org) ? org[0]?.name : org?.name;
    return {
      id: row.id as string,
      organizationId: row.organization_id as string,
      organizationName: orgName?.trim() || "Unknown tenant",
      createdAt: row.created_at as string,
      callerNumber: row.caller_number as string,
      callerName: (row.caller_name as string | null) ?? null,
      durationSeconds: Number(row.duration_seconds ?? 0),
      outcome: String(row.outcome ?? ""),
      postCallStatus: (row.post_call_status as PostCallStatus) ?? "pending",
      postCallExpectedTicket: row.post_call_expected_ticket === true,
      postCallErrors: parsePostCallErrors(row.post_call_errors),
      hasLinkedTicket: linked.has(row.id as string),
      aiSummary: (row.ai_summary as string | null) ?? null,
    };
  });
}

export async function countPostCallHealthIssues(): Promise<number> {
  const admin = createAdminClient();
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .in("post_call_status", ["partial", "failed"])
    .gte("created_at", weekAgoIso);
  if (error) throw error;
  return count ?? 0;
}
