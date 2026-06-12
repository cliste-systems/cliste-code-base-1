import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordComplianceEvent(
  admin: SupabaseClient,
  input: {
    organizationId?: string | null;
    eventType: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("compliance_events").insert({
    organization_id: input.organizationId ?? null,
    event_type: input.eventType,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error(
      "[compliance-events] insert failed",
      input.eventType,
      error.message,
    );
  }
}
