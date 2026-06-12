import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Record one billable SMS segment after a successful Twilio send. */
export async function recordSmsUsage(
  admin: SupabaseClient,
  organizationId: string,
  options?: { segments?: number; purpose?: string },
): Promise<void> {
  const segments = Math.max(1, options?.segments ?? 1);
  const purpose = (options?.purpose ?? "outbound").trim() || "outbound";

  const { error } = await admin.from("sms_usage_records").insert({
    organization_id: organizationId,
    segments,
    purpose,
  });

  if (error) {
    console.error("[sms-usage] failed to record", organizationId, error.message);
  }
}
