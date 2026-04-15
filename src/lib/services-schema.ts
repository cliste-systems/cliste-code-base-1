import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when migrations 010/011 have been applied (`description`, `ai_voice_notes`,
 * `is_published` on `public.services`). Probes with a lightweight select.
 */
export async function servicesTableHasExtendedColumns(
  client: SupabaseClient
): Promise<boolean> {
  const { error } = await client.from("services").select("description").limit(1);
  if (!error) return true;
  const msg = (error.message ?? "").toLowerCase();
  /* Missing migration columns */
  if (msg.includes("does not exist")) return false;
  /* RLS or network: assume extended columns exist so we do not downgrade the app */
  return true;
}

/** Published-only when `is_published` exists; otherwise all rows (legacy schema). */
export function queryServicesForPublicMenu(
  client: SupabaseClient,
  organizationId: string,
  extended: boolean
) {
  if (extended) {
    return client
      .from("services")
      .select("id, name, category, price, duration_minutes, description")
      .eq("organization_id", organizationId)
      .eq("is_published", true)
      .order("name");
  }
  return client
    .from("services")
    .select("id, name, category, price, duration_minutes")
    .eq("organization_id", organizationId)
    .order("name");
}
