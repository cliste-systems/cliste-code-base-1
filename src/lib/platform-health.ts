import "server-only";

import type { PlatformEventRow, PlatformEventSeverity } from "@/lib/platform-events";
import { createAdminClient } from "@/utils/supabase/admin";

export type MissingRecordingRow = {
  id: string;
  created_at: string;
  organization_id: string;
  caller_number: string | null;
  called_number: string | null;
  duration_seconds: number;
  org_name: string | null;
};

export type PlatformHealthSnapshot = {
  events: PlatformEventRow[];
  critical7d: number;
  warning7d: number;
  missingRecordings: MissingRecordingRow[];
};

const DEFAULT_EVENT_LIMIT = 100;
const DEFAULT_MISSING_RECORDING_LIMIT = 20;
const MIN_RECORDING_DURATION_SECONDS = 10;

export async function loadPlatformHealthSnapshot(options?: {
  eventLimit?: number;
  missingRecordingLimit?: number;
}): Promise<PlatformHealthSnapshot> {
  const admin = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const eventLimit = options?.eventLimit ?? DEFAULT_EVENT_LIMIT;
  const missingLimit =
    options?.missingRecordingLimit ?? DEFAULT_MISSING_RECORDING_LIMIT;

  const { data: events, error: eventsError } = await admin
    .from("platform_events")
    .select(
      "id, created_at, severity, category, event_type, source, organization_id, call_log_id, message, metadata",
    )
    .order("created_at", { ascending: false })
    .limit(eventLimit);

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const rows = (events ?? []) as PlatformEventRow[];
  const critical7d = rows.filter(
    (row) =>
      row.severity === "critical" &&
      new Date(row.created_at).getTime() >= new Date(weekAgo).getTime(),
  ).length;
  const warning7d = rows.filter(
    (row) =>
      row.severity === "warning" &&
      new Date(row.created_at).getTime() >= new Date(weekAgo).getTime(),
  ).length;

  const { data: missingRows, error: missingError } = await admin
    .from("call_logs")
    .select(
      "id, created_at, organization_id, caller_number, called_number, duration_seconds, organizations(name)",
    )
    .gte("created_at", weekAgo)
    .gte("duration_seconds", MIN_RECORDING_DURATION_SECONDS)
    .is("audio_storage_path", null)
    .order("created_at", { ascending: false })
    .limit(missingLimit);

  if (missingError) {
    throw new Error(missingError.message);
  }

  const missingRecordings = (missingRows ?? []).map((row) => {
    const org = row.organizations as { name?: string } | { name?: string }[] | null;
    const orgName = Array.isArray(org) ? org[0]?.name : org?.name;
    return {
      id: row.id as string,
      created_at: row.created_at as string,
      organization_id: row.organization_id as string,
      caller_number: (row.caller_number as string | null) ?? null,
      called_number: (row.called_number as string | null) ?? null,
      duration_seconds: Number(row.duration_seconds ?? 0),
      org_name: orgName?.trim() || null,
    };
  });

  return {
    events: rows,
    critical7d,
    warning7d,
    missingRecordings,
  };
}

export async function countPlatformEventsSince(
  sinceIso: string,
  severity?: PlatformEventSeverity,
): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from("platform_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (severity) {
    query = query.eq("severity", severity);
  }
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
