import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationTarget = {
  email: string | null;
  phone: string | null;
  name: string | null;
};

/** Read alert targets from store_contacts, falling back to org notification fields. */
export async function loadStoreNotificationTargets(
  admin: SupabaseClient,
  organizationId: string,
  fallback: { email: string | null; phone: string | null },
): Promise<NotificationTarget[]> {
  const { data: contacts } = await admin
    .from("store_contacts")
    .select("name, email, phone_e164, is_notification_target, active")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .eq("is_notification_target", true);

  const targets: NotificationTarget[] = (contacts ?? [])
    .map((c) => ({
      name: (c.name as string)?.trim() || null,
      email: (c.email as string)?.trim() || null,
      phone: (c.phone_e164 as string)?.trim() || null,
    }))
    .filter((t) => t.email || t.phone);

  if (targets.length > 0) return targets;

  const email = fallback.email?.trim() || null;
  const phone = fallback.phone?.trim() || null;
  if (email || phone) {
    return [{ name: null, email, phone }];
  }
  return [];
}
