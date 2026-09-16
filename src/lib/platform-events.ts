import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformEventSeverity = "critical" | "warning" | "info";

export type PlatformEventCategory =
  | "recording"
  | "webhook"
  | "product_lookup"
  | "worker"
  | "dashboard";

export type PlatformEventRow = {
  id: string;
  created_at: string;
  severity: PlatformEventSeverity;
  category: PlatformEventCategory | string;
  event_type: string;
  source: string;
  organization_id: string | null;
  call_log_id: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
};

export async function recordPlatformEvent(
  admin: SupabaseClient,
  input: {
    severity: PlatformEventSeverity;
    category: PlatformEventCategory | string;
    eventType: string;
    message: string;
    source?: string;
    organizationId?: string | null;
    callLogId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const message = input.message.trim().slice(0, 500);
  if (!message) return;

  const { error } = await admin.from("platform_events").insert({
    severity: input.severity,
    category: input.category,
    event_type: input.eventType,
    source: input.source?.trim() || "app",
    organization_id: input.organizationId ?? null,
    call_log_id: input.callLogId ?? null,
    message,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error(
      "[platform-events] insert failed",
      input.eventType,
      error.message,
    );
  }
}
