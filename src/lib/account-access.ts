import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";

export async function userCanAccessOrganization(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("account_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.account_id) return false;

  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  return Boolean(org?.id);
}

export async function resolveAccountIdForOrganization(
  organizationId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("account_id")
    .eq("id", organizationId)
    .maybeSingle();
  return (data?.account_id as string | null) ?? null;
}
