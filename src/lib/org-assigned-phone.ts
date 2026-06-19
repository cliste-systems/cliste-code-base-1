import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Assigned Irish DID for outbound caller-facing SMS.
 * Owner alerts continue to use the platform TWILIO_SMS_FROM number.
 */
export async function resolveOrgAssignedPhoneE164(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("phone_numbers")
    .select("e164")
    .eq("organization_id", organizationId)
    .eq("status", "assigned")
    .maybeSingle();

  if (error) {
    console.error("[org-phone] lookup failed", organizationId, error.message);
    return null;
  }

  const e164 = String(data?.e164 ?? "").trim();
  return e164 || null;
}
