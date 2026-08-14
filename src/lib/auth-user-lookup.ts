import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve an auth user id by email using a service-role RPC (no listUsers scan). */
export async function lookupAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await admin.rpc("auth_user_id_by_email", {
    p_email: normalized,
  });

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === "string" && data.trim() ? data.trim() : null;
}
