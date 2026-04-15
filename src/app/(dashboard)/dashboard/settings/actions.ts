"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";

import type { WeekSchedule } from "./business-hours";

export type OrganizationSettingsPayload = {
  isActive: boolean;
  freshaUrl: string;
  businessHours: WeekSchedule;
};

export async function saveOrganizationSettings(
  payload: OrganizationSettingsPayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: tierRow, error: tierError } = await supabase
    .from("organizations")
    .select("tier")
    .eq("id", organizationId)
    .single();

  if (tierError || !tierRow) {
    return {
      ok: false,
      message: tierError?.message ?? "Could not load organization.",
    };
  }

  const updates: Record<string, unknown> = {
    is_active: payload.isActive,
    business_hours: payload.businessHours,
    updated_at: new Date().toISOString(),
  };

  if (tierRow.tier === "connect") {
    updates.fresha_url = payload.freshaUrl.trim() || null;
  }

  const { error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
